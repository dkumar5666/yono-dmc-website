begin;

create extension if not exists pgcrypto;

create table if not exists public.revenue_recommendations (
  id uuid primary key default gen_random_uuid(),
  admin_id text,
  lead_id text,
  quote_id text,
  type text not null,
  recommendation jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_revenue_recommendations_created
on public.revenue_recommendations(created_at desc);

create index if not exists idx_revenue_recommendations_lead
on public.revenue_recommendations(lead_id);

create index if not exists idx_revenue_recommendations_type
on public.revenue_recommendations(type);

alter table public.revenue_recommendations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'revenue_recommendations'
      and policyname = 'revenue_recommendations_admin_only'
  ) then
    execute 'create policy revenue_recommendations_admin_only on public.revenue_recommendations for all using (false)';
  end if;
end $$;

commit;
