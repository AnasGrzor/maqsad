-- Milestone 2: student and agent profiles, credentials, connections.

create type public.education_level as enum ('secondary', 'diploma', 'bachelors', 'masters', 'phd', 'other');
create type public.journey_goal as enum ('study', 'work', 'both');
create type public.agent_kind as enum ('education', 'recruitment', 'both');
create type public.credential_kind as enum ('business_registration', 'oep_licence', 'partnership', 'membership', 'other');
create type public.credential_status as enum ('submitted', 'under_review', 'verified', 'rejected');
create type public.connection_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

-- Role of the caller, or null for a signed-out or suspended user.
create function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid()) and status = 'active';
$$;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- Codes are validated against src/lib/taxonomy.ts by the app; these checks only bound their shape.
create function public.codes_ok(codes text[], pattern text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(c ~ pattern), true) from unnest(codes) as c;
$$;

create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  education_level public.education_level not null,
  field text not null check (field ~ '^[a-z_]{1,40}$'),
  qualifications text not null default '' check (char_length(qualifications) <= 1000),
  skills text not null default '' check (char_length(skills) <= 500),
  experience text not null default '' check (char_length(experience) <= 1000),
  destinations text[] not null default '{}'
    check (cardinality(destinations) <= 10 and public.codes_ok(destinations, '^[A-Z]{2}$')),
  goal public.journey_goal not null,
  goals_note text not null default '' check (char_length(goals_note) <= 1000),
  -- Off until the student opts in to discovery.
  visible boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.agent_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  agency_name text not null check (char_length(agency_name) between 1 and 120),
  kind public.agent_kind not null,
  city text not null default '' check (char_length(city) <= 80),
  website text not null default '' check (website = '' or website ~ '^https?://' and char_length(website) <= 200),
  destinations text[] not null default '{}'
    check (cardinality(destinations) <= 20 and public.codes_ok(destinations, '^[A-Z]{2}$')),
  specialisations text[] not null default '{}'
    check (cardinality(specialisations) <= 20 and public.codes_ok(specialisations, '^[a-z_]{1,40}$')),
  levels public.education_level[] not null default '{}',
  fees text not null default '' check (char_length(fees) <= 2000),
  about text not null default '' check (char_length(about) <= 1000),
  updated_at timestamptz not null default now()
);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  kind public.credential_kind not null,
  issuer text not null check (char_length(issuer) between 1 and 120),
  reference text not null default '' check (char_length(reference) <= 80),
  document_path text,
  status public.credential_status not null default 'submitted',
  review_note text not null default '' check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.credentials (agent_id);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status public.connection_status not null default 'pending',
  message text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requested_by in (student_id, agent_id))
);
-- One open request or connection per pair. Declined or withdrawn pairs may try again.
create unique index connections_open_pair on public.connections (student_id, agent_id)
  where status in ('pending', 'accepted');
create index on public.connections (agent_id);

-- ---------------------------------------------------------------- RLS

alter table public.student_profiles enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.credentials enable row level security;
alter table public.connections enable row level security;

create policy "Students manage their own profile"
  on public.student_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.my_role()) = 'student');

-- Agents see visible students, and students who are connected to them or asked to connect.
create policy "Agents read visible or connected students"
  on public.student_profiles for select to authenticated
  using (
    (select public.my_role()) = 'agent' and (
      visible or exists (
        select 1 from public.connections c
        where c.student_id = user_id and c.agent_id = (select auth.uid())
          and (c.status = 'accepted' or (c.status = 'pending' and c.requested_by = c.student_id))
      )
    )
  );

create policy "Admins read student profiles"
  on public.student_profiles for select to authenticated
  using ((select public.is_admin()));

create policy "Agents manage their own profile"
  on public.agent_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.my_role()) = 'agent');

create policy "Signed-in users read agent profiles"
  on public.agent_profiles for select to authenticated
  using ((select public.my_role()) is not null);

create policy "Agents add their own credentials"
  on public.credentials for insert to authenticated
  with check (agent_id = (select auth.uid()) and (select public.my_role()) = 'agent');

-- Students need credential kinds and statuses to judge an agent. Documents stay private in storage.
create policy "Signed-in users read credentials"
  on public.credentials for select to authenticated
  using ((select public.my_role()) is not null);

create policy "Parties read their connections"
  on public.connections for select to authenticated
  using ((select auth.uid()) in (student_id, agent_id) or (select public.is_admin()));

-- Names: agents are public to signed-in users; a student's name only reaches an agent after the
-- student accepts, or when the student asked first.
create policy "Signed-in users read agent names"
  on public.profiles for select to authenticated
  using (role = 'agent' and (select public.my_role()) is not null);

create policy "Connected users read each other's names"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.connections c
      where (c.student_id = profiles.id and c.agent_id = (select auth.uid())
               and (c.status = 'accepted' or (c.status = 'pending' and c.requested_by = c.student_id)))
         or (c.agent_id = profiles.id and c.student_id = (select auth.uid()))
    )
  );

revoke all on public.student_profiles, public.agent_profiles, public.credentials, public.connections from anon, authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select, insert, update on public.agent_profiles to authenticated;
-- Agents choose what they submit; status and review columns are only set by review_credential().
grant select on public.credentials to authenticated;
grant insert (agent_id, kind, issuer, reference, document_path) on public.credentials to authenticated;
-- Connections change only through the functions below.
grant select on public.connections to authenticated;

-- ---------------------------------------------------------------- Connection workflow

create function public.request_connection(target uuid, note text default '')
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
    -- Anti-spam cap until plan limits exist (milestone 5).
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

create function public.respond_connection(connection uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections
  set status = case when accept then 'accepted'::public.connection_status else 'declined' end,
      responded_at = now()
  where id = connection and status = 'pending'
    and auth.uid() in (student_id, agent_id) and requested_by <> auth.uid()
    and public.my_role() is not null;
  if not found then raise exception 'not_available'; end if;
end;
$$;

create function public.withdraw_connection(connection uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections set status = 'withdrawn', responded_at = now()
  where id = connection and status = 'pending' and requested_by = auth.uid();
  if not found then raise exception 'not_available'; end if;
end;
$$;

create function public.review_credential(credential uuid, verdict public.credential_status, note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if verdict = 'submitted' then raise exception 'invalid_verdict'; end if;
  update public.credentials
  set status = verdict, review_note = left(coalesce(note, ''), 500), reviewed_by = auth.uid(), reviewed_at = now()
  where id = credential;
  if not found then raise exception 'not_available'; end if;
end;
$$;

revoke execute on function public.request_connection(uuid, text), public.respond_connection(uuid, boolean),
  public.withdraw_connection(uuid), public.review_credential(uuid, public.credential_status, text) from public, anon;
grant execute on function public.request_connection(uuid, text), public.respond_connection(uuid, boolean),
  public.withdraw_connection(uuid), public.review_credential(uuid, public.credential_status, text) to authenticated;

-- ---------------------------------------------------------------- Credential documents

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credentials', 'credentials', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

-- Files live under <agent id>/; only that agent and admins can read them.
create policy "Agents upload their own credential files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'credentials' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.my_role()) = 'agent'
  );

create policy "Agents and admins read credential files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'credentials'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );
