-- Milestone 6: audit log, account suspension, admin-only email lookup, and access hardening of M1/M2.

-- ---------------------------------------------------------------- Audit log

-- Append-only. Details hold codes and ids only: never personal data, messages or document contents.
-- actor_id and target_id have no foreign keys so history survives account deletion.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]{1,40}\.[a-z_]{1,40}$'),
  target_type text not null check (target_type ~ '^[a-z_]{1,40}$'),
  target_id text check (char_length(target_id) <= 80),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2048),
  created_at timestamptz not null default now()
);
create index on public.audit_log (created_at desc);
create index on public.audit_log (action, created_at desc);
create index on public.audit_log (target_id);

alter table public.audit_log enable row level security;
create policy "Admins read the audit log"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));
revoke all on public.audit_log from public, anon, authenticated;
grant select on public.audit_log to authenticated;

-- Even the table owner cannot rewrite history without first dropping this trigger.
create function public.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

-- The only writer. Not executable by API roles: call it from security-definer functions and triggers.
-- Pattern for other milestones' admin functions (one line, after the change succeeds):
--   perform public.write_audit('dispute.resolve', 'dispute', dispute_id::text, jsonb_build_object('outcome', outcome));
-- The actor is auth.uid() of the API caller, or null for changes made in the SQL console.
create function public.write_audit(action text, target_type text, target_id text, details jsonb default '{}')
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), action, target_type, target_id, coalesce(details, '{}'));
$$;
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- Role and status changes on profiles, however they happen (set_account_status() or SQL).
create function public.audit_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := nullif(current_setting('maqsad.status_reason', true), '');
begin
  if new.role is distinct from old.role then
    perform public.write_audit('account.role_change', 'profile', new.id::text,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.status is distinct from old.status then
    perform public.write_audit(
      case new.status when 'suspended' then 'account.suspend' else 'account.reactivate' end,
      'profile', new.id::text,
      jsonb_strip_nulls(jsonb_build_object('from', old.status, 'to', new.status, 'reason', reason)));
  end if;
  return null;
end;
$$;
create trigger audit_profile_change after update of role, status on public.profiles
  for each row execute function public.audit_profile_change();

-- Credential decisions made by review_credential() (M2). The review note stays out of the log.
create function public.audit_credential_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.write_audit('credential.review', 'credential', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status, 'agent', new.agent_id));
  end if;
  return null;
end;
$$;
create trigger audit_credential_change after update of status on public.credentials
  for each row execute function public.audit_credential_change();

revoke execute on function public.audit_log_immutable(), public.audit_profile_change(), public.audit_credential_change()
  from public, anon, authenticated;

-- ---------------------------------------------------------------- Account management

-- Suspend or reactivate another non-admin account with a reason. Role changes stay SQL-only (and are logged).
create function public.set_account_status(target uuid, new_status public.account_status, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := trim(coalesce(reason, ''));
  their public.user_role;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if char_length(why) not between 3 and 500 then raise exception 'reason_required'; end if;
  if target = auth.uid() then raise exception 'cannot_change_self'; end if;
  select role into their from public.profiles where id = target for update;
  if not found then raise exception 'not_available'; end if;
  if their = 'admin' and new_status = 'suspended' then raise exception 'cannot_suspend_admin'; end if;

  -- The profiles trigger writes the audit row and picks up the reason from this transaction-local setting.
  perform set_config('maqsad.status_reason', why, true);
  update public.profiles set status = new_status where id = target and status <> new_status;
  if not found then raise exception 'no_change'; end if;
  perform set_config('maqsad.status_reason', '', true);

  -- Ends refresh tokens. An access token already issued lasts until it expires, but RLS refuses it (my_role() is null).
  if new_status = 'suspended' then
    delete from auth.sessions where user_id = target;
  end if;
end;
$$;

-- Admins need a user's email to contact them. Only through this function, never a readable view.
create function public.admin_user_email(target uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select email from auth.users where id = target);
end;
$$;

revoke execute on function public.set_account_status(uuid, public.account_status, text), public.admin_user_email(uuid)
  from public, anon;
grant execute on function public.set_account_status(uuid, public.account_status, text), public.admin_user_email(uuid)
  to authenticated;

-- ---------------------------------------------------------------- Hardening of M1/M2 access

-- Suspended users keep a valid access token until it expires, and several M2 policies only checked
-- auth.uid(). Restrictive policies are ANDed with the existing ones: suspended callers read nothing but
-- their own profiles row (the app needs it to show "suspended"), and nobody sees a suspended user's
-- student or agent profile or credentials except admins.
create policy "Suspended users read only their own row"
  on public.profiles as restrictive for select to authenticated
  using (id = (select auth.uid()) or (select public.my_role()) is not null);
create policy "Suspended users can't rename"
  on public.profiles as restrictive for update to authenticated
  using ((select public.my_role()) is not null);

-- Security definer because callers can't always read the other user's profiles row (hidden student names).
-- It reveals only whether a given user id belongs to an active account.
create function public.is_active_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = uid and status = 'active');
$$;
revoke execute on function public.is_active_user(uuid) from public, anon;
grant execute on function public.is_active_user(uuid) to authenticated;

create policy "Active users and active student profiles only"
  on public.student_profiles as restrictive for all to authenticated
  using ((select public.my_role()) is not null and ((select public.is_admin()) or public.is_active_user(user_id)));
create policy "Active users and active agent profiles only"
  on public.agent_profiles as restrictive for all to authenticated
  using ((select public.my_role()) is not null and ((select public.is_admin()) or public.is_active_user(user_id)));
create policy "Active users and active agents' credentials only"
  on public.credentials as restrictive for all to authenticated
  using ((select public.my_role()) is not null and ((select public.is_admin()) or public.is_active_user(agent_id)));
create policy "Active users only"
  on public.connections as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users read credential files"
  on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'credentials' or (select public.my_role()) is not null);

-- An agent could point document_path at another agent's file, which an admin's signed link would then open.
alter table public.credentials add constraint credentials_document_in_own_folder
  check (document_path is null or (document_path like agent_id::text || '/%' and document_path !~ '\.\.'));

-- withdraw_connection() (M2) didn't check that the caller is still active.
create or replace function public.withdraw_connection(connection uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections set status = 'withdrawn', responded_at = now()
  where id = connection and status = 'pending' and requested_by = auth.uid()
    and public.my_role() is not null;
  if not found then raise exception 'not_available'; end if;
end;
$$;

-- Supabase's default grants gave anon and authenticated TRUNCATE, REFERENCES and TRIGGER on profiles
-- (TRUNCATE ignores RLS). Signed-out users need nothing from profiles at all.
revoke all on public.profiles from anon;
revoke truncate, references, trigger on public.profiles from authenticated;
