-- Step 13: B2B Agent ownership linkage for CRM leads
-- Safe additive migration; does not modify existing business logic.

alter table if exists public.leads
  add column if not exists agent_id uuid;

create index if not exists idx_leads_agent_id
  on public.leads(agent_id);

