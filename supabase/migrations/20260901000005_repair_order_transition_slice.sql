-- Repair-order workflow transition slice
-- Adds the transition-history table, the transition permissions, and the atomic RPC that
-- updates the repair order status and inserts the history row in one database transaction.

create table if not exists public.repair_order_transitions (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  transitioned_at timestamptz not null default now()
);

create index if not exists idx_repair_order_transitions_repair_order_id
  on public.repair_order_transitions (repair_order_id, transitioned_at desc);

create index if not exists idx_repair_order_transitions_user_id
  on public.repair_order_transitions (user_id, transitioned_at desc);

alter table public.repair_order_transitions enable row level security;

create policy "repair_order_transitions_members_only_select"
on public.repair_order_transitions
for select
using (
  exists (
    select 1
    from public.repair_orders ro
    where ro.id = repair_order_transitions.repair_order_id
      and (
        exists (
          select 1
          from public.branch_memberships bm
          where bm.branch_id = ro.branch_id
            and bm.profile_id = auth.uid()
            and bm.is_active = true
            and bm.organisation_id = ro.organisation_id
        )
        or exists (
          select 1
          from public.organisation_memberships om
          where om.organisation_id = ro.organisation_id
            and om.profile_id = auth.uid()
            and om.is_active = true
        )
      )
  )
);

create policy "repair_order_transitions_service_only_write"
on public.repair_order_transitions
for all
using (false)
with check (false);

insert into public.permissions (key, resource, action, description)
values
  (
    'repair_order.transition',
    'repair_order',
    'transition',
    'Move a repair order through the approved workflow lifecycle.'
  ),
  (
    'repair_order.cancel',
    'repair_order',
    'cancel',
    'Cancel a repair order in a valid terminal-cancel state.'
  ),
  (
    'repair_order.close',
    'repair_order',
    'close',
    'Close or finalise a completed repair order.'
  ),
  (
    'repair_order.override_transition',
    'repair_order',
    'override_transition',
    'Override workflow gating for exceptional transition requests.'
  ),
  (
    'repair_order.reopen',
    'repair_order',
    'reopen',
    'Reopen a closed or cancelled repair order when explicitly allowed.'
  )
on conflict (key) do nothing;

create or replace function public.transition_repair_order(
  p_repair_order_id uuid,
  p_organisation_id uuid,
  p_branch_id uuid,
  p_target_status text,
  p_user_id uuid
)
returns public.repair_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.repair_orders;
  v_allowed boolean;
  v_from_status text;
  v_target_status text := lower(trim(p_target_status));
begin
  if p_target_status is null or length(trim(p_target_status)) = 0 then
    raise exception 'Invalid transition target status' using errcode = 'P0001';
  end if;

  select *
    into v_row
    from public.repair_orders
   where id = p_repair_order_id
   for update;

  if v_row.id is null then
    raise exception 'Repair order not found' using errcode = 'P0001';
  end if;

  if v_row.organisation_id <> p_organisation_id or v_row.branch_id <> p_branch_id then
    raise exception 'Repair order tenant scope does not match' using errcode = 'P0001';
  end if;

  if v_row.archived_at is not null then
    raise exception 'Repair order is archived and cannot be transitioned' using errcode = 'P0001';
  end if;

  v_from_status := lower(trim(v_row.status));

  v_allowed := (
    (v_from_status = 'intake' and v_target_status = 'diagnosis')
    or (v_from_status = 'intake' and v_target_status = 'cancelled')
    or (v_from_status = 'diagnosis' and v_target_status = 'in_progress')
    or (v_from_status = 'diagnosis' and v_target_status = 'cancelled')
    or (v_from_status = 'in_progress' and v_target_status = 'completed')
    or (v_from_status = 'in_progress' and v_target_status = 'cancelled')
    or (v_from_status = 'completed' and v_target_status = 'delivered')
  );

  if not v_allowed then
    raise exception 'Invalid transition from % to %', v_from_status, v_target_status using errcode = 'P0001';
  end if;

  update public.repair_orders
     set status = v_target_status,
         updated_at = now()
   where id = v_row.id;

  insert into public.repair_order_transitions (
    repair_order_id,
    from_status,
    to_status,
    user_id
  )
  values (
    v_row.id,
    v_from_status,
    v_target_status,
    p_user_id
  );

  select *
    into v_row
    from public.repair_orders
   where id = p_repair_order_id;

  return v_row;
end;
$$;

-- Privileged workflow mutation: route uses the service-role admin client only.
-- Never expose this RPC to app users or the public role.
revoke all on function public.transition_repair_order(uuid, uuid, uuid, text, uuid) from public;
revoke execute on function public.transition_repair_order(uuid, uuid, uuid, text, uuid) from authenticated;
grant execute on function public.transition_repair_order(uuid, uuid, uuid, text, uuid) to service_role;
