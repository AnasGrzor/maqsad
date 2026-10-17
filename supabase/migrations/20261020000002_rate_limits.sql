-- Rate limits for every server action (src/lib/rate-limit.ts). Counts hits per key (a user or, before sign-in, an IP)
-- in fixed windows. /api/analyze has its own stricter limits in 20261020000001_ai_rate_limits.sql.
-- Only the server key may use this: a user calling take_rate_limit() directly could lock out another key.

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);
create index on public.rate_limits (window_start);
-- No policies: only the server key reads or writes it.
alter table public.rate_limits enable row level security;

-- Counts one hit for key and returns true while the window holds at most max_hits.
-- The upsert is atomic, so parallel requests can't all pass. A fixed window lets up to 2 × max_hits through
-- across a window boundary.
create function public.take_rate_limit(key text, max_hits int, window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.rate_limits as r (key, window_start)
  values (take_rate_limit.key, date_bin(make_interval(secs => window_seconds), now(), 'epoch'::timestamptz))
  on conflict on constraint rate_limits_pkey do update set hits = r.hits + 1
  returning r.hits into n;
  -- Old windows are only clutter; clearing them on about 1 call in 100 keeps the table small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= max_hits;
end;
$$;

revoke execute on function public.take_rate_limit(text, int, int) from public, anon, authenticated;
