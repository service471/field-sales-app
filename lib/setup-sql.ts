export const SETUP_SQL = `create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  job_title text,
  company_name text not null,
  sector text,
  address text,
  phone text not null,
  alt_phone text,
  company_email text,
  alt_email text,
  website text,
  status text not null default 'pending',
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_status_check check (status in ('pending', 'completed', 'archived'))
);

alter table public.leads add column if not exists customer_name text;
alter table public.leads add column if not exists job_title text;
alter table public.leads add column if not exists company_email text;
alter table public.leads add column if not exists alt_email text;
alter table public.leads add column if not exists updated_by text;
alter table public.leads add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'contact_name'
  ) then
    update public.leads
      set customer_name = coalesce(customer_name, contact_name)
      where contact_name is not null;
    alter table public.leads drop column contact_name;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'contact_title'
  ) then
    update public.leads
      set job_title = coalesce(job_title, contact_title)
      where contact_title is not null;
    alter table public.leads drop column contact_title;
  end if;
end $$;

update public.leads
  set status = 'pending'
  where status is null
     or status not in ('pending', 'completed', 'archived');

update public.leads
  set updated_at = coalesce(updated_at, created_at, now())
  where updated_at is null;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check check (status in ('pending', 'completed', 'archived'));

create index if not exists leads_status_created_at_idx
  on public.leads (status, created_at);

create or replace function public.reject_duplicate_lead()
returns trigger
language plpgsql
as $$
declare
  digits text;
begin
  if exists (
    select 1
    from public.leads
    where id is distinct from new.id
      and lower(btrim(company_name)) = lower(btrim(new.company_name))
  ) then
    raise exception 'A company with this name already exists.';
  end if;

  digits := regexp_replace(coalesce(new.phone, ''), '\\D', '', 'g');
  if length(digits) >= 7 and exists (
    select 1
    from public.leads
    where id is distinct from new.id
      and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = right(digits, 10)
  ) then
    raise exception 'A company with this phone already exists.';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_reject_duplicate on public.leads;
create trigger leads_reject_duplicate
  before insert or update of company_name, phone
  on public.leads
  for each row
  execute function public.reject_duplicate_lead();

alter table public.leads enable row level security;

drop policy if exists "Public read leads" on public.leads;
drop policy if exists "Public insert leads" on public.leads;
drop policy if exists "Public update leads" on public.leads;
drop policy if exists "Public delete leads" on public.leads;

create policy "Public read leads"
  on public.leads
  for select
  to anon, authenticated
  using (true);

create policy "Public insert leads"
  on public.leads
  for insert
  to anon, authenticated
  with check (true);

create policy "Public update leads"
  on public.leads
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Public delete leads"
  on public.leads
  for delete
  to anon, authenticated
  using (true);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  constraint users_name_unique unique (name),
  constraint users_role_check check (role in ('admin', 'sales'))
);

alter table public.users add column if not exists name text;
alter table public.users add column if not exists role text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_name_unique'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_name_unique unique (name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_check check (role in ('admin', 'sales'));
  end if;
end $$;

create unique index if not exists users_name_lower_idx
  on public.users (lower(name));

alter table public.users enable row level security;

drop policy if exists "Public read users" on public.users;
drop policy if exists "Public insert users" on public.users;
drop policy if exists "Public update users" on public.users;
drop policy if exists "Public delete users" on public.users;

create policy "Public read users"
  on public.users
  for select
  to anon, authenticated
  using (true);

create policy "Public insert users"
  on public.users
  for insert
  to anon, authenticated
  with check (true);

create policy "Public update users"
  on public.users
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Public delete users"
  on public.users
  for delete
  to anon, authenticated
  using (true);

insert into public.users (name, role)
values ('admin', 'admin')
on conflict (name) do nothing;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  action_type text not null,
  company_name text,
  details text,
  created_at timestamptz not null default now()
);

alter table public.activity_logs add column if not exists user_name text;
alter table public.activity_logs add column if not exists action_type text;
alter table public.activity_logs add column if not exists company_name text;
alter table public.activity_logs add column if not exists details text;
alter table public.activity_logs add column if not exists created_at timestamptz default now();

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "Public read activity logs" on public.activity_logs;
drop policy if exists "Public insert activity logs" on public.activity_logs;

create policy "Public read activity logs"
  on public.activity_logs
  for select
  to anon, authenticated
  using (true);

create policy "Public insert activity logs"
  on public.activity_logs
  for insert
  to anon, authenticated
  with check (true);`;
