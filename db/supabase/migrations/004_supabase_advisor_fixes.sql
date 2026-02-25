begin;

-- Fix Supabase Advisor warning: mutable search_path on helper functions
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.jwt_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'user_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() ->> 'role', ''),
    'authenticated'
  );
$$;

grant execute on function public.jwt_role() to authenticated;

-- Enable RLS on tables missed in the initial RLS migration
alter table public.trips enable row level security;
alter table public.products enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.booking_lifecycle_events enable row level security;

-- ---------- TRIPS ----------
drop policy if exists trips_admin_all on public.trips;
drop policy if exists trips_customer_select on public.trips;
drop policy if exists trips_customer_insert on public.trips;
drop policy if exists trips_customer_update on public.trips;

create policy trips_admin_all
on public.trips
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy trips_customer_select
on public.trips
for select
using (customer_id = public.current_customer_id());

create policy trips_customer_insert
on public.trips
for insert
with check (customer_id = public.current_customer_id());

create policy trips_customer_update
on public.trips
for update
using (customer_id = public.current_customer_id())
with check (customer_id = public.current_customer_id());

-- ---------- PRODUCTS ----------
drop policy if exists products_admin_all on public.products;
drop policy if exists products_supplier_select on public.products;
drop policy if exists products_supplier_update on public.products;

create policy products_admin_all
on public.products
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy products_supplier_select
on public.products
for select
using (supplier_id = public.current_supplier_id());

create policy products_supplier_update
on public.products
for update
using (supplier_id = public.current_supplier_id())
with check (supplier_id = public.current_supplier_id());

-- ---------- PAYMENT REFUNDS ----------
drop policy if exists payment_refunds_admin_all on public.payment_refunds;
drop policy if exists payment_refunds_customer_select on public.payment_refunds;

create policy payment_refunds_admin_all
on public.payment_refunds
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy payment_refunds_customer_select
on public.payment_refunds
for select
using (public.customer_has_booking(booking_id));

-- ---------- BOOKING LIFECYCLE EVENTS ----------
drop policy if exists booking_lifecycle_events_admin_all on public.booking_lifecycle_events;
drop policy if exists booking_lifecycle_events_customer_select on public.booking_lifecycle_events;
drop policy if exists booking_lifecycle_events_supplier_select on public.booking_lifecycle_events;

create policy booking_lifecycle_events_admin_all
on public.booking_lifecycle_events
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy booking_lifecycle_events_customer_select
on public.booking_lifecycle_events
for select
using (public.customer_has_booking(booking_id));

create policy booking_lifecycle_events_supplier_select
on public.booking_lifecycle_events
for select
using (public.supplier_has_booking(booking_id));

commit;
