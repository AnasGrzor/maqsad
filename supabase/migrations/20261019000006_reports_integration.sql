-- Integration of milestone 4 (saved verification reports) with milestone 3 (cases) and milestone 6 (suspension).

alter table public.verification_reports
  add constraint verification_reports_case_id_fkey foreign key (case_id) references public.cases (id) on delete set null;
create index on public.verification_reports (case_id);

-- Owners attach a report to one of their own applications, or detach it with null. The link stays private to the
-- owner: reports are saved with the student's own session, so the other party must not treat them as verified.
create function public.link_report(report uuid, target_case uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_case is not null and not public.is_case_party(target_case) then raise exception 'not_available'; end if;
  update public.verification_reports set case_id = target_case
  where id = report and owner_id = auth.uid() and public.my_role() is not null;
  if not found then raise exception 'not_available'; end if;
end;
$$;
revoke execute on function public.link_report(uuid, uuid) from public, anon;
grant execute on function public.link_report(uuid, uuid) to authenticated;

create policy "Active users only" on public.verification_reports as restrictive for all to authenticated
  using ((select public.my_role()) is not null);
