-- Integration of milestones 3, 5 and 6, written after the parallel branches were merged.

-- ---------------------------------------------------------------- Plan gating for cases and messages (M3 + M5)

-- A connection gets a feature when either party's plan includes it. Free students keep core application
-- tracking with any agent; messaging and fee records need Agent Professional on one side (or Student Plus).
create function public.connection_allows(c public.connections, feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id in (public.plan_of(c.student_id), public.plan_of(c.agent_id)) and feature = any (p.features)
  );
$$;
revoke execute on function public.connection_allows(public.connections, text) from public, anon, authenticated;

create or replace function public.require_connection(connection uuid, action text)
returns public.connections
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.connections;
  feature text := case action
    when 'send_message' then 'messaging'
    when 'add_case_record' then 'feeRecords'
    when 'open_case' then 'caseTracking'
    when 'set_case_status' then 'caseTracking'
    when 'add_case_item' then 'caseTracking'
    when 'set_item_status' then 'caseTracking'
  end;
begin
  select * into c from public.connections
  where id = connection and status = 'accepted' and auth.uid() in (student_id, agent_id);
  if c.id is null or public.my_role() is null then raise exception 'not_available'; end if;
  if feature is null or not public.connection_allows(c, feature) then raise exception 'plan_required'; end if;
  return c;
end;
$$;

-- Agents on Agent Basic get a few checks a month so they can screen documents students send them.
update public.plans
set verification_reports_per_month = 3, features = array_append(features, 'documentCheck')
where id = 'agent_basic' and not 'documentCheck' = any (features);

-- ---------------------------------------------------------------- Admin handling of reports and disputes (M3 + M6)

alter table public.disputes add column resolution_note text not null default ''
  check (char_length(resolution_note) <= 1000);

create function public.review_dispute(dispute uuid, new_status public.dispute_status, note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if new_status = 'open' then raise exception 'invalid_status'; end if;
  update public.disputes
  set status = new_status, resolution_note = left(coalesce(note, ''), 1000), updated_at = now()
  where id = dispute;
  if not found then raise exception 'not_available'; end if;
  perform public.write_audit('dispute.review', 'dispute', dispute::text, jsonb_build_object('status', new_status));
end;
$$;
revoke execute on function public.review_dispute(uuid, public.dispute_status, text) from public, anon;
grant execute on function public.review_dispute(uuid, public.dispute_status, text) to authenticated;

-- ---------------------------------------------------------------- Audit plan administration (M5 + M6)

create function public.audit_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Updates that change nothing (re-saving the same values) aren't decisions worth recording.
  if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;
  if tg_table_name = 'plans' then
    perform public.write_audit('plan.update', 'plan', new.id, jsonb_build_object(
      'price', new.price_monthly_pkr, 'reports', new.verification_reports_per_month, 'offered', new.offered));
  elsif tg_table_name = 'subscriptions' then
    perform public.write_audit('subscription.grant', 'profile', new.user_id::text, jsonb_build_object('plan', new.plan_id));
  elsif new.status is distinct from old.status then
    perform public.write_audit('plan_request.decide', 'plan_request', new.id::text, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_plan_change() from public, anon, authenticated;

create trigger audit_plan_update after update on public.plans
  for each row execute function public.audit_plan_change();
create trigger audit_subscription after insert or update on public.subscriptions
  for each row execute function public.audit_plan_change();
create trigger audit_plan_request after update of status on public.subscription_requests
  for each row execute function public.audit_plan_change();

-- ---------------------------------------------------------------- Suspended accounts see nothing (M6 rule on M3/M5 tables)

create policy "Active users only" on public.cases as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.case_items as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.case_records as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.case_events as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.messages as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.notifications as restrictive for all to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.disputes as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.subscriptions as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.subscription_requests as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
create policy "Active users only" on public.usage_events as restrictive for select to authenticated
  using ((select public.my_role()) is not null);
