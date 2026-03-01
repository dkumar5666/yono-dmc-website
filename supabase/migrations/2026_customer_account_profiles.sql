create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  phone_verified boolean not null default false,
  nationality text,
  city text,
  dob date,
  preferred_airport text,
  passport_no text,
  passport_expiry date,
  pan text,
  travel_type text,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travellers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  passport_no text,
  expiry_date date,
  relationship text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_wallet (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0,
  tier text not null default 'Explorer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_profiles_phone on public.customer_profiles(phone);
create index if not exists idx_customer_profiles_email on public.customer_profiles(email);
create index if not exists idx_customer_profiles_completed on public.customer_profiles(profile_completed);
create index if not exists idx_travellers_customer on public.travellers(customer_id);
create index if not exists idx_travellers_created on public.travellers(created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.travellers enable row level security;
alter table public.customer_wallet enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_profiles' and policyname = 'customer_profiles_select_own'
  ) then
    execute 'create policy customer_profiles_select_own on public.customer_profiles for select using (auth.uid() = id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_profiles' and policyname = 'customer_profiles_insert_own'
  ) then
    execute 'create policy customer_profiles_insert_own on public.customer_profiles for insert with check (auth.uid() = id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_profiles' and policyname = 'customer_profiles_update_own'
  ) then
    execute 'create policy customer_profiles_update_own on public.customer_profiles for update using (auth.uid() = id) with check (auth.uid() = id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'travellers' and policyname = 'travellers_select_own'
  ) then
    execute 'create policy travellers_select_own on public.travellers for select using (auth.uid() = customer_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'travellers' and policyname = 'travellers_insert_own'
  ) then
    execute 'create policy travellers_insert_own on public.travellers for insert with check (auth.uid() = customer_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'travellers' and policyname = 'travellers_update_own'
  ) then
    execute 'create policy travellers_update_own on public.travellers for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'travellers' and policyname = 'travellers_delete_own'
  ) then
    execute 'create policy travellers_delete_own on public.travellers for delete using (auth.uid() = customer_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_wallet' and policyname = 'customer_wallet_select_own'
  ) then
    execute 'create policy customer_wallet_select_own on public.customer_wallet for select using (auth.uid() = customer_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_wallet' and policyname = 'customer_wallet_insert_own'
  ) then
    execute 'create policy customer_wallet_insert_own on public.customer_wallet for insert with check (auth.uid() = customer_id)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_wallet' and policyname = 'customer_wallet_update_own'
  ) then
    execute 'create policy customer_wallet_update_own on public.customer_wallet for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id)';
  end if;
end $$;
