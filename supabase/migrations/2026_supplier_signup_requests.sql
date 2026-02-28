create extension if not exists pgcrypto;

create table if not exists public.supplier_signup_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'verified', 'approved', 'rejected')),
  business_type text,
  company_legal_name text,
  brand_name text,
  address text,
  city text,
  country text,
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  alt_phone text,
  support_email text,
  gstin text,
  pan text,
  cin text,
  iata_code text,
  license_no text,
  bank_meta jsonb not null default '{}'::jsonb,
  docs jsonb not null default '{}'::jsonb,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_supplier_signup_requests_contact_email
on public.supplier_signup_requests (contact_email)
where contact_email is not null;

create unique index if not exists ux_supplier_signup_requests_contact_phone
on public.supplier_signup_requests (contact_phone)
where contact_phone is not null;

create index if not exists idx_supplier_signup_requests_status
on public.supplier_signup_requests (status);

create index if not exists idx_supplier_signup_requests_created_at
on public.supplier_signup_requests (created_at desc);

alter table public.supplier_signup_requests enable row level security;

drop policy if exists supplier_signup_requests_public_insert on public.supplier_signup_requests;
create policy supplier_signup_requests_public_insert
on public.supplier_signup_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists supplier_signup_requests_admin_select on public.supplier_signup_requests;
create policy supplier_signup_requests_admin_select
on public.supplier_signup_requests
for select
to authenticated
using (
  coalesce(auth.jwt() ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists supplier_signup_requests_admin_update on public.supplier_signup_requests;
create policy supplier_signup_requests_admin_update
on public.supplier_signup_requests
for update
to authenticated
using (
  coalesce(auth.jwt() ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  coalesce(auth.jwt() ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists supplier_signup_requests_admin_delete on public.supplier_signup_requests;
create policy supplier_signup_requests_admin_delete
on public.supplier_signup_requests
for delete
to authenticated
using (
  coalesce(auth.jwt() ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

insert into storage.buckets (id, name, public)
values ('supplier-kyc', 'supplier-kyc', false)
on conflict (id) do nothing;
