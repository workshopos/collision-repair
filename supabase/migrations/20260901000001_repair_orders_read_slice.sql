-- Minimal repair-order slice for single-record read access
-- Requires the existing public.branches unique constraint on (id, organisation_id)
-- from the tenant foundation migration.

create table if not exists public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  branch_id uuid not null,
  ro_number text not null,
  status text not null default 'intake',
  customer_id uuid,
  vehicle_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, ro_number),
  foreign key (branch_id, organisation_id)
    references public.branches(id, organisation_id)
    on delete cascade
);

create index if not exists idx_repair_orders_organisation_id
  on public.repair_orders (organisation_id);

create index if not exists idx_repair_orders_branch_id
  on public.repair_orders (branch_id);

create index if not exists idx_repair_orders_organisation_branch
  on public.repair_orders (organisation_id, branch_id);

create index if not exists idx_repair_orders_status
  on public.repair_orders (organisation_id, branch_id, status);

create trigger trg_repair_orders_updated_at
before update on public.repair_orders
for each row execute function public.set_updated_at();

alter table public.repair_orders enable row level security;

create policy "repair_orders_members_only_select"
on public.repair_orders
for select
using (
  exists (
    select 1
    from public.branch_memberships bm
    where bm.branch_id = repair_orders.branch_id
      and bm.profile_id = auth.uid()
      and bm.is_active = true
      and bm.organisation_id = repair_orders.organisation_id
  )
  or exists (
    select 1
    from public.organisation_memberships om
    where om.organisation_id = repair_orders.organisation_id
      and om.profile_id = auth.uid()
      and om.is_active = true
  )
);

create policy "repair_orders_service_only_write"
on public.repair_orders
for all
using (false)
with check (false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.branches'::regclass
      AND conname = 'branches_id_organisation_id_key'
  ) THEN
    RAISE EXCEPTION 'Required composite unique constraint on public.branches(id, organisation_id) is missing.';
  END IF;
END $$;
