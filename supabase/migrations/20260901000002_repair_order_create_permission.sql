-- Register the repair-order creation permission used by the create endpoint.
insert into public.permissions (key, resource, action, description)
values (
  'repair_order.create',
  'repair_order',
  'create',
  'Create repair orders within an authorised organisation and branch.'
)
on conflict (key) do nothing;
