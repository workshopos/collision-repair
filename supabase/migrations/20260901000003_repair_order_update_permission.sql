-- Register the repair-order update permission used by the update endpoint.
insert into public.permissions (key, resource, action, description)
values (
  'repair_order.update',
  'repair_order',
  'update',
  'Update permitted repair-order fields within an authorised organisation and branch.'
)
on conflict (key) do nothing;
