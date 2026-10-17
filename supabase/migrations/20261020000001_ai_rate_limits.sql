-- Rate limits for /api/analyze. Each check spends one Gemini call and two Groq calls on free quotas, so the server
-- records every check that may reach the models and refuses bursts per user and across the whole app.
-- Only the server key may use this: a user calling take_ai_check() directly could fill the app-wide cap.

create table public.ai_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.ai_checks (created_at);
create index on public.ai_checks (user_id, created_at);
-- No policies: only the server key reads or writes it.
alter table public.ai_checks enable row level security;

-- Records one check for uid and returns its id, or raises the first limit it would break:
-- rate_limited (uid, last minute), hourly_limit (uid, last hour), busy (app, last minute), daily_limit (app, last 24 hours).
-- The windows roll, so 24 hours always holds at most app_per_day checks, whenever a provider resets its quota.
create function public.take_ai_check(uid uuid, per_minute int, per_hour int, app_per_minute int, app_per_day int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  -- One check at a time app-wide, so parallel requests can't all pass the counts below.
  perform pg_advisory_xact_lock(hashtextextended('ai_checks', 0));
  delete from public.ai_checks where created_at < now() - interval '1 day';
  if (select count(*) from public.ai_checks) >= app_per_day then raise exception 'daily_limit'; end if;
  if (select count(*) from public.ai_checks where created_at > now() - interval '1 minute') >= app_per_minute then
    raise exception 'busy';
  end if;
  if (select count(*) from public.ai_checks where user_id = uid and created_at > now() - interval '1 minute') >= per_minute then
    raise exception 'rate_limited';
  end if;
  if (select count(*) from public.ai_checks where user_id = uid and created_at > now() - interval '1 hour') >= per_hour then
    raise exception 'hourly_limit';
  end if;
  insert into public.ai_checks (user_id) values (uid) returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.take_ai_check(uuid, int, int, int, int) from public, anon, authenticated;
