-- Reconcile the repair-order lifecycle model introduced by
-- 20260903000001_repair_order_lifecycle_stage_model.sql.
--
-- This migration is intentionally forward-only. It converts the original
-- status-based transition history, removes both legacy RPC overloads, and
-- installs the tenant-checked lifecycle RPC used by the transition route.

begin;

alter table public.repair_order_transitions
  add column if not exists actor_id uuid,
  add column if not exists action text,
  add column if not exists from_lifecycle_status repair_order_lifecycle_status,
  add column if not exists from_primary_stage repair_order_primary_stage,
  add column if not exists to_lifecycle_status repair_order_lifecycle_status,
  add column if not exists to_primary_stage repair_order_primary_stage,
  add column if not exists reason text,
  add column if not exists created_at timestamptz;

update public.repair_order_transitions
set actor_id = user_id,
    action = 'legacy_status_transition',
    from_lifecycle_status = case from_status
      when 'intake' then 'intake'::repair_order_lifecycle_status
      when 'diagnosis' then 'intake'::repair_order_lifecycle_status
      when 'in_progress' then 'in_repair'::repair_order_lifecycle_status
      when 'completed' then 'completed'::repair_order_lifecycle_status
      when 'delivered' then 'delivered'::repair_order_lifecycle_status
      when 'cancelled' then 'cancelled'::repair_order_lifecycle_status
    end,
    from_primary_stage = case
      when from_status = 'in_progress' then 'disassembly'::repair_order_primary_stage
      else null
    end,
    to_lifecycle_status = case to_status
      when 'intake' then 'intake'::repair_order_lifecycle_status
      when 'diagnosis' then 'intake'::repair_order_lifecycle_status
      when 'in_progress' then 'in_repair'::repair_order_lifecycle_status
      when 'completed' then 'completed'::repair_order_lifecycle_status
      when 'delivered' then 'delivered'::repair_order_lifecycle_status
      when 'cancelled' then 'cancelled'::repair_order_lifecycle_status
    end,
    to_primary_stage = case
      when to_status = 'in_progress' then 'disassembly'::repair_order_primary_stage
      else null
    end,
    created_at = transitioned_at
where actor_id is null
   or action is null
   or from_lifecycle_status is null
   or to_lifecycle_status is null
   or created_at is null;

alter table public.repair_order_transitions
  alter column actor_id set not null,
  alter column action set not null,
  alter column from_lifecycle_status set not null,
  alter column to_lifecycle_status set not null,
  alter column created_at set not null;

alter table public.repair_order_transitions
  add constraint repair_order_transitions_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete restrict;

alter table public.repair_order_transitions
  add constraint repair_order_transitions_lifecycle_stage_check
  check (
    (from_lifecycle_status = 'in_repair' and from_primary_stage is not null)
    or (from_lifecycle_status <> 'in_repair' and from_primary_stage is null)
  ),
  add constraint repair_order_transitions_target_stage_check
  check (
    (to_lifecycle_status = 'in_repair' and to_primary_stage is not null)
    or (to_lifecycle_status <> 'in_repair' and to_primary_stage is null)
  );

alter table public.repair_order_transitions
  drop column from_status,
  drop column to_status,
  drop column user_id,
  drop column transitioned_at;

alter table public.repair_order_transitions
  rename column created_at to transitioned_at;

drop index if exists public.idx_repair_orders_status;
alter table public.repair_orders
  drop column legacy_status;

create index if not exists idx_repair_order_transitions_actor_id
  on public.repair_order_transitions (actor_id, transitioned_at desc);

 drop function if exists public.transition_repair_order(uuid, uuid, uuid, text, uuid);
 drop function if exists public.transition_repair_order(
  uuid,
  text,
  uuid,
  public.repair_order_primary_stage,
  text
 );

create or replace function public.transition_repair_order(
  p_repair_order_id uuid,
  p_action text,
  p_actor_id uuid,
  p_organisation_id uuid,
  p_branch_id uuid,
  p_target_stage public.repair_order_primary_stage default null,
  p_reason text default null
)
returns public.repair_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.repair_orders%rowtype;
  v_from_lifecycle public.repair_order_lifecycle_status;
  v_from_stage public.repair_order_primary_stage;
  v_next_stage public.repair_order_primary_stage;
  v_stages public.repair_order_primary_stage[] := array[
    'disassembly', 'parts_ordering', 'panel_beating', 'paint_preparation',
    'painting', 'assembly', 'outwork_polishing', 'final_inspection'
  ]::public.repair_order_primary_stage[];
  v_current_index integer;
begin
  select * into v_row
  from public.repair_orders
  where id = p_repair_order_id
  for update;

  if not found then
    raise exception 'repair_order % not found', p_repair_order_id using errcode = 'P0002';
  end if;

  if v_row.organisation_id <> p_organisation_id
     or v_row.branch_id <> p_branch_id then
    raise exception 'Repair order tenant scope does not match' using errcode = 'P0001';
  end if;

  if v_row.archived_at is not null then
    raise exception 'Repair order is archived and cannot be transitioned' using errcode = 'P0001';
  end if;

  v_from_lifecycle := v_row.lifecycle_status;
  v_from_stage := v_row.primary_repair_stage;

  if p_action = 'start_repair' then
    if v_from_lifecycle <> 'intake' then
      raise exception 'cannot start_repair from lifecycle_status %', v_from_lifecycle using errcode = 'P0001';
    end if;

    update public.repair_orders
    set lifecycle_status = 'in_repair',
        primary_repair_stage = 'disassembly',
        updated_at = now()
    where id = p_repair_order_id
    returning * into v_row;
  elsif p_action = 'advance' then
    if v_from_lifecycle <> 'in_repair' then
      raise exception 'cannot advance: lifecycle_status is %, not in_repair', v_from_lifecycle using errcode = 'P0001';
    end if;

    v_current_index := array_position(v_stages, v_from_stage);
    if v_current_index is null or v_current_index = cardinality(v_stages) then
      raise exception 'final_inspection is the last stage; use the complete action instead' using errcode = 'P0001';
    end if;

    v_next_stage := v_stages[v_current_index + 1];
    update public.repair_orders
    set primary_repair_stage = v_next_stage,
        updated_at = now()
    where id = p_repair_order_id
    returning * into v_row;
  elsif p_action = 'reject_to_stage' then
    if v_from_lifecycle <> 'in_repair' then
      raise exception 'cannot reject_to_stage: lifecycle_status is %, not in_repair', v_from_lifecycle using errcode = 'P0001';
    end if;

    if p_target_stage is null then
      raise exception 'reject_to_stage requires p_target_stage' using errcode = 'P0001';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'reject_to_stage requires a non-empty p_reason' using errcode = 'P0001';
    end if;

    if p_target_stage >= v_from_stage then
      raise exception 'reject_to_stage target (%) must be earlier than current stage (%)', p_target_stage, v_from_stage using errcode = 'P0001';
    end if;

    update public.repair_orders
    set primary_repair_stage = p_target_stage,
        updated_at = now()
    where id = p_repair_order_id
    returning * into v_row;
  elsif p_action = 'complete' then
    if v_from_lifecycle <> 'in_repair' or v_from_stage <> 'final_inspection' then
      raise exception 'complete requires lifecycle_status=in_repair and stage=final_inspection (got % / %)', v_from_lifecycle, v_from_stage using errcode = 'P0001';
    end if;

    update public.repair_orders
    set lifecycle_status = 'completed',
        primary_repair_stage = null,
        updated_at = now()
    where id = p_repair_order_id
    returning * into v_row;
  elsif p_action = 'deliver' then
    if v_from_lifecycle <> 'completed' then
      raise exception 'cannot deliver: lifecycle_status is %, not completed', v_from_lifecycle using errcode = 'P0001';
    end if;

    update public.repair_orders
    set lifecycle_status = 'delivered',
        updated_at = now()
    where id = p_repair_order_id
    returning * into v_row;
  elsif p_action = 'cancel' then
    if v_from_lifecycle not in ('intake', 'in_repair') then
      raise exception 'cannot cancel from lifecycle_status %', v_from_lifecycle using errcode = 'P0001';
    end if;

    update public.repair_orders
    set lifecycle_status = 'cancelled',
        primary_repair_stage = null,
        updated_at = now()
    where id = p_repair_order_id
    returning * into v_row;
  else
    raise exception 'unknown transition action: %', p_action using errcode = 'P0001';
  end if;

  insert into public.repair_order_transitions (
    repair_order_id,
    actor_id,
    action,
    from_lifecycle_status,
    from_primary_stage,
    to_lifecycle_status,
    to_primary_stage,
    reason,
    transitioned_at
  ) values (
    p_repair_order_id,
    p_actor_id,
    p_action,
    v_from_lifecycle,
    v_from_stage,
    v_row.lifecycle_status,
    v_row.primary_repair_stage,
    p_reason,
    now()
  );

  return v_row;
end;
$$;

revoke all on function public.transition_repair_order(
  uuid, text, uuid, uuid, uuid, public.repair_order_primary_stage, text
) from public;
revoke execute on function public.transition_repair_order(
  uuid, text, uuid, uuid, uuid, public.repair_order_primary_stage, text
) from authenticated;
grant execute on function public.transition_repair_order(
  uuid, text, uuid, uuid, uuid, public.repair_order_primary_stage, text
) to service_role;

commit;
