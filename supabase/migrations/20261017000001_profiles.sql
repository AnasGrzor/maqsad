-- Roles and account status for every user. Auth itself lives in auth.users.

create type public.user_role as enum ('student', 'agent', 'admin');
create type public.account_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Security definer so policies on profiles can ask "is the caller an admin?"
-- without recursing into profiles' own RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Admins read all profiles"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column grants stop users changing their own role or status through the policy above.
-- Inserts only happen in the signup trigger, so no insert policy or grant exists.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Signup metadata is user-controlled, so only student or agent is accepted here.
-- Admins are promoted by hand: update public.profiles set role = 'admin' where id = '...';
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  name text := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80);
begin
  if requested is null or requested not in ('student', 'agent') then
    raise exception 'role must be student or agent';
  end if;
  insert into public.profiles (id, role, display_name)
  values (new.id, requested::public.user_role, coalesce(nullif(name, ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
