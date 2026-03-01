begin;

create extension if not exists pgcrypto;

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  applies_to text not null check (applies_to in ('hotel', 'transfer', 'activity', 'package', 'visa', 'insurance', 'flight_fee')),
  destination text,
  supplier text,
  rule_type text not null check (rule_type in ('percent', 'fixed')),
  value numeric not null default 0,
  currency text not null default 'INR',
  priority int not null default 100,
  active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_rule_versions (
  version_id uuid not null references public.pricing_versions(id),
  rule_id uuid not null references public.pricing_rules(id),
  created_at timestamptz not null default now(),
  primary key (version_id, rule_id)
);

create unique index if not exists ux_pricing_versions_version
on public.pricing_versions(version);

create index if not exists idx_pricing_rules_applies_to_priority
on public.pricing_rules(applies_to, priority);

create index if not exists idx_pricing_rules_destination
on public.pricing_rules(destination);

create index if not exists idx_pricing_rules_supplier
on public.pricing_rules(supplier);

create index if not exists idx_pricing_versions_status_created
on public.pricing_versions(status, created_at desc);

create index if not exists idx_pricing_rule_versions_rule
on public.pricing_rule_versions(rule_id);

insert into public.pricing_versions (version, status)
select 1, 'active'
where not exists (select 1 from public.pricing_versions);

insert into public.pricing_rule_versions (version_id, rule_id)
select v.id, r.id
from public.pricing_versions v
cross join public.pricing_rules r
where v.status = 'active'
  and not exists (
    select 1
    from public.pricing_rule_versions prv
    where prv.version_id = v.id
      and prv.rule_id = r.id
  );

alter table public.pricing_rules enable row level security;
alter table public.pricing_versions enable row level security;
alter table public.pricing_rule_versions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pricing_rules'
      and policyname = 'pricing_rules_admin_only'
  ) then
    execute 'create policy pricing_rules_admin_only on public.pricing_rules for all using (false)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pricing_versions'
      and policyname = 'pricing_versions_admin_only'
  ) then
    execute 'create policy pricing_versions_admin_only on public.pricing_versions for all using (false)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pricing_rule_versions'
      and policyname = 'pricing_rule_versions_admin_only'
  ) then
    execute 'create policy pricing_rule_versions_admin_only on public.pricing_rule_versions for all using (false)';
  end if;
end $$;

commit;
