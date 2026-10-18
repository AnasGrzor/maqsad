-- Milestone 4: verification reports a student chose to save from the document checker.
-- Only the report is kept: never the uploaded file, the pasted text or the personal fields read from it
-- (the app removes recipient names, account numbers, phones and emails before inserting).

create table public.verification_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Links a report to an application case. No foreign key yet: cases are built in a parallel milestone.
  case_id uuid,
  created_at timestamptz not null default now(),
  doc_type text not null check (doc_type in (
    'university_offer', 'scholarship_offer', 'agent_message', 'visa_letter',
    'degree_or_transcript', 'job_offer', 'internship', 'other'
  )),
  issuer_name text not null default '' check (char_length(issuer_name) <= 200),
  risk text not null check (risk in ('high', 'medium', 'low', 'incomplete')),
  findings jsonb not null default '[]' check (jsonb_typeof(findings) = 'array' and pg_column_size(findings) <= 200000),
  summary_en text not null default '' check (char_length(summary_en) <= 4000),
  summary_ur text not null default '' check (char_length(summary_ur) <= 4000),
  official_contact jsonb check (official_contact is null or jsonb_typeof(official_contact) = 'object' and pg_column_size(official_contact) <= 4000),
  warnings jsonb not null default '[]' check (jsonb_typeof(warnings) = 'array' and pg_column_size(warnings) <= 20000)
);
create index on public.verification_reports (owner_id, created_at desc);

alter table public.verification_reports enable row level security;

-- Saved through /api/analyze with the student's own session.
create policy "Students save their own reports"
  on public.verification_reports for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.my_role()) = 'student');

create policy "Owners and admins read reports"
  on public.verification_reports for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

create policy "Owners delete their reports"
  on public.verification_reports for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Reports are a record of what a check found, so nobody edits them. case_id is set by a later
-- milestone through a function that checks case membership, so users can't insert it either.
revoke all on public.verification_reports from anon, authenticated;
grant select, delete on public.verification_reports to authenticated;
grant insert (owner_id, doc_type, issuer_name, risk, findings, summary_en, summary_ur, official_contact, warnings)
  on public.verification_reports to authenticated;
