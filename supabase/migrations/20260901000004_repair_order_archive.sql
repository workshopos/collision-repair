-- Add soft-delete metadata and register the repair-order archive permission.
alter table public.repair_orders
  add column if not exists archived_at timestamptz;

create index if not exists idx_repair_orders_active_scope
  on public.repair_orders (organisation_id, branch_id, created_at desc)
  where archived_at is null;

insert into public.permissions (key, resource, action, description)
values (
  'repair_order.archive',
  'repair_order',
  'archive',
  'Archive historical repair orders within an authorised organisation and branch.'
)
on conflict (key) do nothing;
