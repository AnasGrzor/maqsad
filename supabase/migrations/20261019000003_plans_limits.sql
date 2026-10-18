-- Milestone 5: plans, the current plan of each user, upgrade requests and monthly usage limits.
-- No payments: an upgrade is a request that an admin approves or declines. Plans give features, never
-- verified status (that only comes from review_credential()).

create type public.subscription_request_status as enum ('pending', 'approved', 'declined');

create table public.plans (
  id text primary key check (id ~ '^[a-z_]{1,40}$'),
  audience public.user_role not null check (audience <> 'admin'),
  offered boolean not null default false,
  -- PKR a month; null means the price is not set yet.
  price_monthly_pkr integer check (price_monthly_pkr between 0 and 10000000),
  -- Document checks a month; null means not included.
  verification_reports_per_month integer check (verification_reports_per_month between 0 and 100000),
  -- Keys of src/lib/features.ts that the plan includes (full list, not only the extras).
  features text[] not null default '{}' check (public.codes_ok(features, '^[a-zA-Z]{1,40}$')),
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.plans (id, audience, offered, price_monthly_pkr, verification_reports_per_month, features, sort_order) values
  ('student_free', 'student', true, 0, 3,
    '{accounts,documentCheck,studentProfile,profileVisibility,agentDirectory,connections,caseTracking}', 1),
  ('student_plus', 'student', false, null, 20,
    '{accounts,documentCheck,studentProfile,profileVisibility,agentDirectory,connections,caseTracking,savedReports,feeRecords}', 2),
  ('agent_basic', 'agent', true, null, null,
    '{accounts,agentProfile,credentialSubmission,studentDiscovery,matching,connections}', 3),
  ('agent_professional', 'agent', true, null, 30,
    '{accounts,agentProfile,credentialSubmission,studentDiscovery,matching,connections,messaging,caseTracking,feeRecords,documentCheck}', 4),
  ('agency', 'agent', false, null, null, '{}', 5);

-- A user without a row is on their audience's default plan (see current_plan()).
create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  note text not null default '' check (char_length(note) <= 500)
);

create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  message text not null default '' check (char_length(message) <= 500),
  status public.subscription_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 500)
);
create unique index subscription_requests_one_pending on public.subscription_requests (user_id) where status = 'pending';

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('verification_report')),
  created_at timestamptz not null default now()
);
create index on public.usage_events (user_id, kind, created_at);

-- ---------------------------------------------------------------- RLS

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_requests enable row level security;
alter table public.usage_events enable row level security;

create policy "Everyone reads plans" on public.plans for select to anon, authenticated using (true);

create policy "Users read their own subscription, admins all"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users read their own plan requests, admins all"
  on public.subscription_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users read their own usage"
  on public.usage_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Every write goes through the security-definer functions below.
revoke all on public.plans, public.subscriptions, public.subscription_requests, public.usage_events from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.subscriptions, public.subscription_requests, public.usage_events to authenticated;

-- ---------------------------------------------------------------- Plan of a user

-- Not granted to users: other security-definer functions may ask about any user, users only about themselves.
create function public.plan_of(who uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s join public.plans p on p.id = s.plan_id
      where s.user_id = pr.id and p.audience = pr.role),
    case pr.role when 'student' then 'student_free' when 'agent' then 'agent_basic' end)
  from public.profiles pr
  where pr.id = who and pr.status = 'active' and pr.role <> 'admin';
$$;

-- The caller's plan id, or null for signed-out, suspended and admin accounts.
create function public.current_plan()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.plan_of((select auth.uid()));
$$;

-- Whether the caller's plan includes a feature key from src/lib/features.ts. Other milestones call this
-- inside their own functions: if not public.plan_allows('messaging') then raise exception 'plan_required'; end if;
create function public.plan_allows(feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select feature = any (p.features) from public.plans p where p.id = public.current_plan()), false);
$$;

-- ---------------------------------------------------------------- Monthly usage

-- Usage resets at the start of each calendar month in Pakistan time.
create function public.usage_month_start(ts timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', ts at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
$$;

-- The caller's allowance this month: {"plan", "used", "limit" (null = not included), "resets_at"}.
create function public.allowance(kind text default 'verification_report')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  plan text := public.current_plan();
  starts timestamptz := public.usage_month_start(now());
  cap integer;
  used integer;
begin
  if kind is distinct from 'verification_report' then raise exception 'invalid_kind'; end if;
  if plan is null then raise exception 'not_available'; end if;
  select verification_reports_per_month into cap from public.plans where id = plan;
  select count(*) into used from public.usage_events u
    where u.user_id = me and u.kind = allowance.kind and u.created_at >= starts;
  return jsonb_build_object('plan', plan, 'used', used, 'limit', cap,
    'resets_at', public.usage_month_start(starts + interval '32 days'));
end;
$$;

-- Records one use for the caller if the plan allows it this month, and returns allowance() after it.
-- Raises not_available (signed out, suspended or admin), not_included (null limit) or limit_reached.
create function public.use_allowance(kind text default 'verification_report')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  state jsonb;
begin
  if me is null then raise exception 'not_available'; end if;
  -- One use at a time per user, so parallel calls can't all pass the count below.
  perform pg_advisory_xact_lock(hashtextextended('usage:' || me::text, 0));
  state := public.allowance(kind);
  if state -> 'limit' = 'null'::jsonb then raise exception 'not_included'; end if;
  if (state ->> 'used')::int >= (state ->> 'limit')::int then raise exception 'limit_reached'; end if;
  insert into public.usage_events (user_id, kind) values (me, kind);
  return state || jsonb_build_object('used', (state ->> 'used')::int + 1);
end;
$$;

-- ---------------------------------------------------------------- Upgrade requests

create function public.request_plan(plan text, note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  my public.user_role := public.my_role();
  new_id uuid;
begin
  if my is null or my = 'admin'
     or not exists (select 1 from public.plans where id = plan and audience = my and offered) then
    raise exception 'not_available';
  end if;
  if plan = public.current_plan() then raise exception 'already_on_plan'; end if;
  insert into public.subscription_requests (user_id, plan_id, message)
  values (auth.uid(), plan, left(coalesce(note, ''), 500)) returning id into new_id;
  return new_id;
exception
  when unique_violation then raise exception 'already_pending';
end;
$$;

-- Approval moves the user to the requested plan. No payment is taken or recorded here.
create function public.decide_plan_request(request uuid, approve boolean, note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.subscription_requests;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.subscription_requests
  set status = case when approve then 'approved'::public.subscription_request_status else 'declined' end,
      decided_by = auth.uid(), decided_at = now(), decision_note = left(coalesce(note, ''), 500)
  where id = request and status = 'pending'
  returning * into r;
  if not found then raise exception 'not_available'; end if;
  if approve then
    -- Students only hold student plans and agents agent plans.
    if not exists (
      select 1 from public.profiles pr join public.plans p on p.audience = pr.role
      where pr.id = r.user_id and p.id = r.plan_id
    ) then
      raise exception 'not_available';
    end if;
    insert into public.subscriptions (user_id, plan_id, granted_by, granted_at, note)
    values (r.user_id, r.plan_id, auth.uid(), now(), left(coalesce(note, ''), 500))
    on conflict (user_id) do update
      set plan_id = excluded.plan_id, granted_by = excluded.granted_by, granted_at = excluded.granted_at, note = excluded.note;
  end if;
end;
$$;

-- ---------------------------------------------------------------- Admin plan editing

create function public.update_plan(plan text, price integer, reports integer, is_offered boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.plans
  set price_monthly_pkr = price, verification_reports_per_month = reports, offered = is_offered,
      updated_by = auth.uid(), updated_at = now()
  where id = plan;
  if not found then raise exception 'not_available'; end if;
end;
$$;

revoke execute on function public.plan_of(uuid), public.current_plan(), public.plan_allows(text),
  public.usage_month_start(timestamptz), public.allowance(text), public.use_allowance(text),
  public.request_plan(text, text), public.decide_plan_request(uuid, boolean, text),
  public.update_plan(text, integer, integer, boolean) from public, anon;
grant execute on function public.current_plan(), public.plan_allows(text), public.allowance(text),
  public.use_allowance(text), public.request_plan(text, text), public.decide_plan_request(uuid, boolean, text),
  public.update_plan(text, integer, integer, boolean) to authenticated;
-- Supabase grants new functions to authenticated by default; plan_of() answers about any user, so only
-- other security-definer functions may call it.
revoke execute on function public.plan_of(uuid), public.usage_month_start(timestamptz) from authenticated;
