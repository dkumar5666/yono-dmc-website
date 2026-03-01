create extension if not exists pgcrypto;

alter table if exists public.customer_profiles
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists auth_provider text default 'local',
  add column if not exists password_set_at timestamptz;

update public.customer_profiles
set
  email_verified_at = coalesce(email_verified_at, created_at),
  auth_provider = coalesce(nullif(auth_provider, ''), 'local')
where email is not null;

update public.customer_profiles
set phone_verified_at = coalesce(phone_verified_at, created_at)
where phone_verified = true
  and phone is not null;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'customer_profiles'
      and indexname = 'idx_customer_profiles_email_lower'
  ) then
    execute 'create index idx_customer_profiles_email_lower on public.customer_profiles (lower(email)) where email is not null';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'customer_profiles'
      and indexname = 'idx_customer_profiles_phone_e164'
  ) then
    execute 'create index idx_customer_profiles_phone_e164 on public.customer_profiles (phone) where phone is not null';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'customer_profiles'
      and indexname = 'ux_customer_profiles_email_lower'
  ) and not exists (
    select 1
    from public.customer_profiles
    where email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    execute 'create unique index ux_customer_profiles_email_lower on public.customer_profiles (lower(email)) where email is not null';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'customer_profiles'
      and indexname = 'ux_customer_profiles_phone_e164'
  ) and not exists (
    select 1
    from public.customer_profiles
    where phone is not null
    group by phone
    having count(*) > 1
  ) then
    execute 'create unique index ux_customer_profiles_phone_e164 on public.customer_profiles (phone) where phone is not null';
  end if;
end $$;

alter table if exists public.customers
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists auth_provider text default 'local',
  add column if not exists phone_e164 text,
  add column if not exists password_set_at timestamptz;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'customers') then
    execute 'update public.customers set phone_e164 = coalesce(phone_e164, phone) where phone is not null and (phone_e164 is null or phone_e164 = '''')';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'customers')
    and not exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'customers' and indexname = 'idx_customers_email_lower'
    ) then
    execute 'create index idx_customers_email_lower on public.customers (lower(email)) where email is not null';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'customers')
    and not exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'customers' and indexname = 'idx_customers_phone_e164'
    ) then
    execute 'create index idx_customers_phone_e164 on public.customers (phone_e164) where phone_e164 is not null';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'customers')
    and not exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'customers' and indexname = 'ux_customers_email_lower'
    ) and not exists (
      select 1
      from public.customers
      where email is not null
      group by lower(email)
      having count(*) > 1
    ) then
    execute 'create unique index ux_customers_email_lower on public.customers (lower(email)) where email is not null';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'customers')
    and not exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'customers' and indexname = 'ux_customers_phone_e164'
    ) and not exists (
      select 1
      from public.customers
      where phone_e164 is not null
      group by phone_e164
      having count(*) > 1
    ) then
    execute 'create unique index ux_customers_phone_e164 on public.customers (phone_e164) where phone_e164 is not null';
  end if;
end $$;
