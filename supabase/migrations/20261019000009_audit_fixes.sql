-- Fixes from the audit after milestone 6: Student Plus messaging, the pending-request cap race, and audit entries
-- for plan saves that change nothing.

-- ---------------------------------------------------------------- Student Plus includes messaging

-- The pricing page, the plan_required message and connection_allows() already promise it.
update public.plans set features = array_append(features, 'messaging')
where id = 'student_plus' and not 'messaging' = any (features);

-- ---------------------------------------------------------------- Pending-request cap under concurrency

-- Same as 20261018000001_profiles_connections.sql, plus a per-agent lock so parallel requests can't all pass the
-- count before any of them inserts. create or replace keeps the existing grants.
create or replace function public.request_connection(target uuid, note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my public.user_role := public.my_role();
  their public.user_role;
  new_id uuid;
begin
  select role into their from public.profiles where id = target and status = 'active';
  if my = 'student' and their = 'agent' then
    if not exists (select 1 from public.agent_profiles where user_id = target) then
      raise exception 'not_available';
    end if;
    insert into public.connections (student_id, agent_id, requested_by, message)
    values (me, target, me, left(coalesce(note, ''), 500)) returning id into new_id;
  elsif my = 'agent' and their = 'student' then
    if not exists (select 1 from public.agent_profiles where user_id = me) then
      raise exception 'profile_required';
    end if;
    if not exists (select 1 from public.student_profiles where user_id = target and visible) then
      raise exception 'not_available';
    end if;
    -- Anti-spam cap on requests waiting for an answer.
    perform pg_advisory_xact_lock(hashtextextended('conn:' || me::text, 0));
    if (select count(*) from public.connections where requested_by = me and status = 'pending') >= 20 then
      raise exception 'too_many_pending';
    end if;
    insert into public.connections (student_id, agent_id, requested_by, message)
    values (target, me, me, left(coalesce(note, ''), 500)) returning id into new_id;
  else
    raise exception 'not_available';
  end if;
  return new_id;
exception
  when unique_violation then raise exception 'already_connected';
end;
$$;

-- ---------------------------------------------------------------- Audit only real plan changes

-- update_plan() always sets updated_at and updated_by, and decide_plan_request() sets granted_at, so a whole-row
-- comparison never matched. Compare only the columns that mean a decision.
create or replace function public.audit_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'plans' then
    if (new.price_monthly_pkr, new.verification_reports_per_month, new.offered, new.features)
      is not distinct from (old.price_monthly_pkr, old.verification_reports_per_month, old.offered, old.features) then
      return new;
    end if;
    perform public.write_audit('plan.update', 'plan', new.id, jsonb_build_object(
      'price', new.price_monthly_pkr, 'reports', new.verification_reports_per_month, 'offered', new.offered));
  elsif tg_table_name = 'subscriptions' then
    if tg_op = 'UPDATE' and new.plan_id = old.plan_id then return new; end if;
    perform public.write_audit('subscription.grant', 'profile', new.user_id::text, jsonb_build_object('plan', new.plan_id));
  elsif new.status is distinct from old.status then
    perform public.write_audit('plan_request.decide', 'plan_request', new.id::text, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_plan_change() from public, anon, authenticated;
