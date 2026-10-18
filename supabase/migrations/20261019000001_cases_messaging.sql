-- Milestone 3: cases, case items, activity history, fee and commitment records, messaging,
-- notifications, and user-side reports and disputes. Everything happens between the two parties of an
-- accepted connection. Writes go through the security-definer functions below; tables only grant SELECT.

create type public.case_kind as enum ('study', 'work');
create type public.case_status as enum ('active', 'completed', 'closed');
create type public.case_item_kind as enum ('requirement', 'document_request', 'milestone', 'deadline');
create type public.case_item_status as enum ('open', 'done');
create type public.case_record_kind as enum
  ('fee_disclosed', 'responsibility', 'promise', 'expected_date', 'terms_change', 'payment_reported');
create type public.dispute_kind as enum ('report', 'dispute');
create type public.dispute_reason as enum
  ('misleading_information', 'undisclosed_fees', 'fee_dispute', 'missed_commitment', 'document_concern',
   'pressure_tactics', 'harassment', 'impersonation', 'other');
create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'dismissed');

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  -- Copied from the connection so RLS doesn't need a join.
  student_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind public.case_kind not null,
  -- Validated against src/lib/taxonomy.ts by the app; this only bounds the shape.
  country text not null check (country ~ '^[A-Z]{2}$'),
  status public.case_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.cases (connection_id);
create index on public.cases (student_id);
create index on public.cases (agent_id);

create table public.case_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind public.case_item_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  details text not null default '' check (char_length(details) <= 2000),
  due_on date,
  status public.case_item_status not null default 'open',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_by uuid references public.profiles (id) on delete cascade,
  completed_at timestamptz
);
create index on public.case_items (case_id);

-- Append-only: corrections are new rows that point at the record they correct.
create table public.case_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind public.case_record_kind not null,
  summary text not null check (char_length(summary) between 1 and 1000),
  amount numeric(14, 2) check (amount >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  on_date date,
  corrects uuid references public.case_records (id) on delete cascade,
  recorded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((amount is null) = (currency is null))
);
create index on public.case_records (case_id);

-- Append-only history, written only by the log_case_event() trigger.
create table public.case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('case_opened', 'status_changed', 'item_added', 'item_done', 'item_reopened', 'record_added')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.case_events (case_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages (connection_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('case_opened', 'status_changed', 'item_added', 'item_done', 'item_reopened', 'record_added',
                    'message', 'connection_request', 'connection_accepted')),
  connection_id uuid references public.connections (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- Visible to the person who raised it and to admins, never to the other party.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles (id) on delete cascade,
  against uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  record_id uuid references public.case_records (id) on delete set null,
  kind public.dispute_kind not null,
  reason public.dispute_reason not null,
  details text not null check (char_length(details) between 1 and 2000),
  status public.dispute_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.disputes (raised_by);
create index on public.disputes (status, created_at);

-- ---------------------------------------------------------------- Append-only guard

-- No one updates or deletes history, records or messages, including security-definer code. Deletes that
-- cascade from a removed account or connection run inside the foreign key's own trigger (depth > 1).
create function public.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'append_only';
end;
$$;

create trigger append_only before update or delete on public.case_events
  for each row execute function public.forbid_change();
create trigger append_only before update or delete on public.case_records
  for each row execute function public.forbid_change();
create trigger append_only before update or delete on public.messages
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------- Access helpers

-- Used by read policies. Security definer so policies don't recurse into each other's RLS.
create function public.is_case_party(target_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_role() is not null and exists (
    select 1 from public.cases where id = target_case and (select auth.uid()) in (student_id, agent_id)
  );
$$;

create function public.is_connection_party(connection uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_role() is not null and exists (
    select 1 from public.connections where id = connection and (select auth.uid()) in (student_id, agent_id)
  );
$$;

-- THE gate for every case and message write: the caller is an active party of an ACCEPTED connection.
-- Milestone 5: put the plan check (Agent Basic vs Professional) here, keyed on `action`, which is one of
-- open_case, set_case_status, add_case_item, set_item_status, add_case_record, send_message.
create function public.require_connection(connection uuid, action text)
returns public.connections
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.connections;
begin
  select * into c from public.connections
  where id = connection and status = 'accepted' and auth.uid() in (student_id, agent_id);
  if c.id is null or public.my_role() is null then raise exception 'not_available'; end if;
  return c;
end;
$$;

create function public.require_case(target_case uuid, action text)
returns public.cases
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k public.cases;
begin
  select * into k from public.cases where id = target_case;
  if k.id is null then raise exception 'not_available'; end if;
  perform public.require_connection(k.connection_id, action);
  return k;
end;
$$;

-- ---------------------------------------------------------------- RLS

alter table public.cases enable row level security;
alter table public.case_items enable row level security;
alter table public.case_records enable row level security;
alter table public.case_events enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.disputes enable row level security;

-- Admins can read case data so they can handle disputes that point at it. Messages stay between the parties.
create policy "Parties and admins read cases"
  on public.cases for select to authenticated
  using (((select auth.uid()) in (student_id, agent_id) and (select public.my_role()) is not null) or (select public.is_admin()));

create policy "Parties and admins read case items"
  on public.case_items for select to authenticated
  using (public.is_case_party(case_id) or (select public.is_admin()));

create policy "Parties and admins read case records"
  on public.case_records for select to authenticated
  using (public.is_case_party(case_id) or (select public.is_admin()));

create policy "Parties and admins read case history"
  on public.case_events for select to authenticated
  using (public.is_case_party(case_id) or (select public.is_admin()));

create policy "Parties read their messages"
  on public.messages for select to authenticated
  using (public.is_connection_party(connection_id));

create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Raisers and admins read disputes"
  on public.disputes for select to authenticated
  using (raised_by = (select auth.uid()) or (select public.is_admin()));

revoke all on public.cases, public.case_items, public.case_records, public.case_events, public.messages,
  public.notifications, public.disputes from anon, authenticated;
grant select on public.cases, public.case_items, public.case_records, public.case_events, public.messages,
  public.notifications, public.disputes to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------- History and notifications (triggers)

create function public.log_case_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'cases' then
    if tg_op = 'INSERT' then
      insert into public.case_events (case_id, actor_id, kind, detail)
      values (new.id, new.opened_by, 'case_opened', jsonb_build_object('title', new.title));
    elsif new.status is distinct from old.status then
      insert into public.case_events (case_id, actor_id, kind, detail)
      values (new.id, auth.uid(), 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  elsif tg_table_name = 'case_items' then
    if tg_op = 'INSERT' then
      insert into public.case_events (case_id, actor_id, kind, detail)
      values (new.case_id, new.created_by, 'item_added', jsonb_build_object('title', new.title, 'kind', new.kind));
    elsif new.status is distinct from old.status then
      insert into public.case_events (case_id, actor_id, kind, detail)
      values (new.case_id, auth.uid(), case when new.status = 'done' then 'item_done' else 'item_reopened' end,
              jsonb_build_object('title', new.title, 'kind', new.kind));
    end if;
  elsif tg_table_name = 'case_records' then
    insert into public.case_events (case_id, actor_id, kind, detail)
    values (new.case_id, new.recorded_by, 'record_added',
            jsonb_build_object('kind', new.kind, 'summary', left(new.summary, 120), 'corrects', new.corrects));
  end if;
  return null;
end;
$$;

create trigger log_case_event after insert or update of status on public.cases
  for each row execute function public.log_case_event();
create trigger log_case_event after insert or update of status on public.case_items
  for each row execute function public.log_case_event();
create trigger log_case_event after insert on public.case_records
  for each row execute function public.log_case_event();

-- Every case event notifies the case's parties other than the actor.
create function public.notify_case_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, connection_id, case_id)
  select p, new.actor_id, new.kind, c.connection_id, c.id
  from public.cases c, unnest(array[c.student_id, c.agent_id]) as p
  where c.id = new.case_id and p <> new.actor_id;
  return null;
end;
$$;

create trigger notify_case_event after insert on public.case_events
  for each row execute function public.notify_case_event();

create function public.notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, connection_id, case_id)
  select case when new.sender_id = c.student_id then c.agent_id else c.student_id end,
         new.sender_id, 'message', c.id, new.case_id
  from public.connections c where c.id = new.connection_id;
  return null;
end;
$$;

create trigger notify_message after insert on public.messages
  for each row execute function public.notify_message();

-- Added by milestone 3 on milestone 2's connections table: new requests and acceptances.
create function public.notify_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid := case when new.requested_by = new.student_id then new.agent_id else new.student_id end;
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, kind, connection_id)
    values (other, new.requested_by, 'connection_request', new.id);
  elsif new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.notifications (user_id, actor_id, kind, connection_id)
    values (new.requested_by, other, 'connection_accepted', new.id);
  end if;
  return null;
end;
$$;

create trigger notify_connection after insert or update of status on public.connections
  for each row execute function public.notify_connection();

-- ---------------------------------------------------------------- Workflow functions

create function public.open_case(connection uuid, title text, kind public.case_kind, country text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.connections := public.require_connection(connection, 'open_case');
  new_id uuid;
begin
  insert into public.cases (connection_id, student_id, agent_id, opened_by, title, kind, country)
  values (c.id, c.student_id, c.agent_id, auth.uid(), trim(title), kind, country)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.set_case_status(target_case uuid, new_status public.case_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.cases := public.require_case(target_case, 'set_case_status');
begin
  update public.cases set status = new_status, updated_at = now() where id = k.id and status <> new_status;
end;
$$;

create function public.add_case_item(target_case uuid, kind public.case_item_kind, title text,
  details text default '', due_on date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.cases := public.require_case(target_case, 'add_case_item');
  new_id uuid;
begin
  insert into public.case_items (case_id, kind, title, details, due_on, created_by)
  values (k.id, kind, trim(title), coalesce(details, ''), due_on, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create function public.set_item_status(item uuid, done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.case_items;
  next_status public.case_item_status := case when done then 'done' else 'open' end;
begin
  select * into i from public.case_items where id = item;
  if i.id is null then raise exception 'not_available'; end if;
  perform public.require_case(i.case_id, 'set_item_status');
  update public.case_items
  set status = next_status,
      completed_by = case when done then auth.uid() end,
      completed_at = case when done then now() end
  where id = i.id and status <> next_status;
end;
$$;

create function public.add_case_record(target_case uuid, kind public.case_record_kind, summary text,
  amount numeric default null, currency text default null, on_date date default null, correction_of uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.cases := public.require_case(target_case, 'add_case_record');
  new_id uuid;
begin
  if correction_of is not null
     and not exists (select 1 from public.case_records r where r.id = correction_of and r.case_id = k.id) then
    raise exception 'not_available';
  end if;
  insert into public.case_records (case_id, kind, summary, amount, currency, on_date, corrects, recorded_by)
  values (k.id, kind, trim(summary), amount, currency, on_date, correction_of, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create function public.send_message(connection uuid, body text, target_case uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.connections := public.require_connection(connection, 'send_message');
  new_id uuid;
begin
  if target_case is not null
     and not exists (select 1 from public.cases k where k.id = target_case and k.connection_id = c.id) then
    raise exception 'not_available';
  end if;
  insert into public.messages (connection_id, case_id, sender_id, body)
  values (c.id, target_case, auth.uid(), trim(body))
  returning id into new_id;
  return new_id;
end;
$$;

-- Any party of a connection may report, whatever its status: suspicious behaviour can start before acceptance.
create function public.raise_dispute(connection uuid, kind public.dispute_kind, reason public.dispute_reason,
  details text, target_case uuid default null, target_record uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.connections;
  new_id uuid;
begin
  select * into c from public.connections where id = connection and auth.uid() in (student_id, agent_id);
  if c.id is null or public.my_role() is null then raise exception 'not_available'; end if;
  if target_case is not null
     and not exists (select 1 from public.cases k where k.id = target_case and k.connection_id = c.id) then
    raise exception 'not_available';
  end if;
  if target_record is not null and not exists (
    select 1 from public.case_records r join public.cases k on k.id = r.case_id
    where r.id = target_record and k.connection_id = c.id and (target_case is null or k.id = target_case)
  ) then
    raise exception 'not_available';
  end if;
  insert into public.disputes (raised_by, against, connection_id, case_id, record_id, kind, reason, details)
  values (auth.uid(), case when auth.uid() = c.student_id then c.agent_id else c.student_id end,
          c.id, target_case, target_record, kind, reason, trim(details))
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------- Function privileges

revoke execute on function
  public.forbid_change(), public.log_case_event(), public.notify_case_event(), public.notify_message(),
  public.notify_connection(), public.require_connection(uuid, text), public.require_case(uuid, text)
  from public, anon, authenticated;

revoke execute on function
  public.is_case_party(uuid), public.is_connection_party(uuid),
  public.open_case(uuid, text, public.case_kind, text), public.set_case_status(uuid, public.case_status),
  public.add_case_item(uuid, public.case_item_kind, text, text, date), public.set_item_status(uuid, boolean),
  public.add_case_record(uuid, public.case_record_kind, text, numeric, text, date, uuid),
  public.send_message(uuid, text, uuid),
  public.raise_dispute(uuid, public.dispute_kind, public.dispute_reason, text, uuid, uuid)
  from public, anon;
grant execute on function
  public.is_case_party(uuid), public.is_connection_party(uuid),
  public.open_case(uuid, text, public.case_kind, text), public.set_case_status(uuid, public.case_status),
  public.add_case_item(uuid, public.case_item_kind, text, text, date), public.set_item_status(uuid, boolean),
  public.add_case_record(uuid, public.case_record_kind, text, numeric, text, date, uuid),
  public.send_message(uuid, text, uuid),
  public.raise_dispute(uuid, public.dispute_kind, public.dispute_reason, text, uuid, uuid)
  to authenticated;
