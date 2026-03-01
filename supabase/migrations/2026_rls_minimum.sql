begin;

-- Step 14: minimum RLS hardening for portal isolation.
-- Notes:
-- 1) Customer/agent/supplier portal reads are currently server-mediated.
-- 2) Service-role server APIs bypass RLS by design.
-- 3) Client-facing access is restricted to explicit self policies only.

do $$
declare
  has_agent_id boolean;
  has_created_by boolean;
  leads_owner_expr text;
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_select'
    ) then
      execute 'create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid())';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_update'
    ) then
      execute 'create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid())';
    end if;
  end if;

  if to_regclass('public.leads') is not null then
    execute 'alter table public.leads enable row level security';

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'leads' and column_name = 'agent_id'
    ) into has_agent_id;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'leads' and column_name = 'created_by'
    ) into has_created_by;

    leads_owner_expr := null;
    if has_agent_id then
      leads_owner_expr := '(agent_id = auth.uid())';
    end if;
    if has_created_by then
      if leads_owner_expr is null then
        leads_owner_expr := '(created_by::text = auth.uid()::text)';
      else
        leads_owner_expr := leads_owner_expr || ' or (created_by::text = auth.uid()::text)';
      end if;
    end if;

    if leads_owner_expr is not null then
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_agent_select_own'
      ) then
        execute 'create policy leads_agent_select_own on public.leads for select to authenticated using (' || leads_owner_expr || ')';
      end if;

      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_agent_insert_own'
      ) then
        execute 'create policy leads_agent_insert_own on public.leads for insert to authenticated with check (' || leads_owner_expr || ')';
      end if;

      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_agent_update_own'
      ) then
        execute 'create policy leads_agent_update_own on public.leads for update to authenticated using (' || leads_owner_expr || ') with check (' || leads_owner_expr || ')';
      end if;
    end if;
  end if;

  if to_regclass('public.quotations') is not null then
    execute 'alter table public.quotations enable row level security';
  end if;

  if to_regclass('public.bookings') is not null then
    execute 'alter table public.bookings enable row level security';
  end if;

  if to_regclass('public.payments') is not null then
    execute 'alter table public.payments enable row level security';
  end if;

  if to_regclass('public.documents') is not null then
    execute 'alter table public.documents enable row level security';
  end if;

  if to_regclass('public.support_requests') is not null then
    execute 'alter table public.support_requests enable row level security';
  end if;

  if to_regclass('public.supplier_logs') is not null then
    execute 'alter table public.supplier_logs enable row level security';
  end if;

  if to_regclass('public.automation_failures') is not null then
    execute 'alter table public.automation_failures enable row level security';
  end if;

  if to_regclass('public.admin_audit_logs') is not null then
    execute 'alter table public.admin_audit_logs enable row level security';
  end if;
end $$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles',
    'leads',
    'quotations',
    'bookings',
    'payments',
    'documents',
    'support_requests',
    'supplier_logs',
    'automation_failures',
    'admin_audit_logs'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = tbl || '_client_block'
    ) then
      execute 'create policy ' || quote_ident(tbl || '_client_block') ||
        ' on public.' || quote_ident(tbl) ||
        ' for all to anon, authenticated using (false) with check (false)';
    end if;
  end loop;
end $$;

commit;
