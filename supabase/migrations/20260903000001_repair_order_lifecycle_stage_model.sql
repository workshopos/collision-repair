-- Migration: 20260903000001_repair_order_lifecycle_stage_model.sql
--
-- Implements ADR-0002: Repair Order Lifecycle & Primary Repair Stage Model.
-- Supersedes the flat 6-value `status` enum with two fields:
--   - lifecycle_status:     broad position in the shop workflow
--   - primary_repair_stage: the PRD's 8 authoritative stages (only
--                           meaningful while lifecycle_status = 'in_repair')
--
-- ASSUMPTIONS — verify against your real schema before running:
--   1. Your repair_orders table currently has a `status` text/enum column.
--      This migration renames it to `legacy_status` rather than dropping it,
--      so you can inspect/roll back. Drop it yourself in a later migration
--      once you've confirmed the backfill below is correct.
--   2. A transition-history table already exists (per audit: migration 007
--      added "Transition history tracking"). This migration assumes it's
--      called `repair_order_transitions` with roughly the columns used
--      below. RENAME/ADJUST the INSERT in the RPC to match your real table
--      if the name or columns differ — everything else in this file is
--      independent of that detail.
--   3. RLS policies on repair_orders are scoped by organisation_id/branch_id,
--      not by the status column — so they should NOT need changes here.
--      Re-run your RLS integration tests after this migration to confirm.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New enum types
-- ---------------------------------------------------------------------------

CREATE TYPE repair_order_lifecycle_status AS ENUM (
  'intake',
  'in_repair',
  'completed',
  'delivered',
  'cancelled'
);

-- Declaration order matters: Postgres enums are ordered by creation order,
-- so 'disassembly' < 'parts_ordering' < ... < 'final_inspection' works
-- directly with <, >, <= in SQL. This is relied on by the RPC below for
-- sequence validation — do not reorder this type after creation without
-- a fresh migration (PRD explicitly requires this exact order anyway).
CREATE TYPE repair_order_primary_stage AS ENUM (
  'disassembly',
  'parts_ordering',
  'panel_beating',
  'paint_preparation',
  'painting',
  'assembly',
  'outwork_polishing',
  'final_inspection'
);

-- ---------------------------------------------------------------------------
-- 2. Add new columns, preserve old column for rollback safety
-- ---------------------------------------------------------------------------

ALTER TABLE repair_orders
  RENAME COLUMN status TO legacy_status;

ALTER TABLE repair_orders
  ADD COLUMN lifecycle_status repair_order_lifecycle_status,
  ADD COLUMN primary_repair_stage repair_order_primary_stage;

-- ---------------------------------------------------------------------------
-- 3. Backfill existing rows from legacy_status
--
-- NOTE: 'in_progress' rows cannot be mapped to a specific one of the 8
-- stages automatically — that information was never captured under the
-- old model. This backfill conservatively places all such rows at the
-- FIRST stage (disassembly). This is almost certainly wrong for rows that
-- were actually further along. Query the flagged rows after this migration
-- (see the SELECT at the bottom of this file) and correct them manually,
-- or via a follow-up data-fix script, before relying on stage-based
-- reporting for pre-existing repair orders.
-- ---------------------------------------------------------------------------

UPDATE repair_orders
SET lifecycle_status = CASE legacy_status
      WHEN 'intake'      THEN 'intake'::repair_order_lifecycle_status
      WHEN 'diagnosis'   THEN 'intake'::repair_order_lifecycle_status
      WHEN 'in_progress' THEN 'in_repair'::repair_order_lifecycle_status
      WHEN 'completed'   THEN 'completed'::repair_order_lifecycle_status
      WHEN 'delivered'   THEN 'delivered'::repair_order_lifecycle_status
      WHEN 'cancelled'   THEN 'cancelled'::repair_order_lifecycle_status
    END,
    primary_repair_stage = CASE legacy_status
      WHEN 'in_progress' THEN 'disassembly'::repair_order_primary_stage
      ELSE NULL
    END;

ALTER TABLE repair_orders
  ALTER COLUMN lifecycle_status SET NOT NULL,
  ALTER COLUMN lifecycle_status SET DEFAULT 'intake';

-- ---------------------------------------------------------------------------
-- 4. Constraints
-- ---------------------------------------------------------------------------

ALTER TABLE repair_orders
  ADD CONSTRAINT repair_orders_stage_lifecycle_check CHECK (
    (lifecycle_status = 'in_repair'  AND primary_repair_stage IS NOT NULL) OR
    (lifecycle_status <> 'in_repair' AND primary_repair_stage IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 5. Indexes for operational queries
-- ---------------------------------------------------------------------------

CREATE INDEX idx_repair_orders_org_branch_lifecycle
  ON repair_orders (organisation_id, branch_id, lifecycle_status);

-- Partial index: only rows actually in-repair have a stage, so no point
-- indexing NULLs for everyone else.
CREATE INDEX idx_repair_orders_org_stage
  ON repair_orders (organisation_id, primary_repair_stage)
  WHERE primary_repair_stage IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Transition RPC
--
-- Replaces the old transition_repair_order() function. Actions:
--   start_repair    intake      -> in_repair (stage := disassembly)
--   advance         in_repair   -> in_repair (stage := next stage in order)
--   reject_to_stage in_repair   -> in_repair (stage := any EARLIER stage;
--                                              requires p_reason)
--   complete        in_repair   -> completed (only from final_inspection)
--   deliver         completed   -> delivered
--   cancel          intake/in_repair -> cancelled
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION transition_repair_order(
  p_repair_order_id uuid,
  p_action text,
  p_actor_id uuid,
  p_target_stage repair_order_primary_stage DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS repair_orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_row repair_orders%ROWTYPE;
  v_from_lifecycle repair_order_lifecycle_status;
  v_from_stage repair_order_primary_stage;
  v_next_stage repair_order_primary_stage;
  -- Ordered stage list, mirrors the enum declaration order above.
  -- Used only to compute "the stage after this one" for `advance`.
  v_stages repair_order_primary_stage[] := ARRAY[
    'disassembly', 'parts_ordering', 'panel_beating', 'paint_preparation',
    'painting', 'assembly', 'outwork_polishing', 'final_inspection'
  ]::repair_order_primary_stage[];
  v_current_index int;
BEGIN
  -- Lock the row for the duration of this transition to avoid two
  -- concurrent transitions racing each other into an inconsistent state.
  SELECT * INTO v_row
  FROM repair_orders
  WHERE id = p_repair_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'repair_order % not found', p_repair_order_id
      USING ERRCODE = 'P0002';
  END IF;

  v_from_lifecycle := v_row.lifecycle_status;
  v_from_stage := v_row.primary_repair_stage;

  IF p_action = 'start_repair' THEN
    IF v_from_lifecycle <> 'intake' THEN
      RAISE EXCEPTION 'cannot start_repair from lifecycle_status %', v_from_lifecycle
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE repair_orders
    SET lifecycle_status = 'in_repair',
        primary_repair_stage = 'disassembly'
    WHERE id = p_repair_order_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'advance' THEN
    IF v_from_lifecycle <> 'in_repair' THEN
      RAISE EXCEPTION 'cannot advance: lifecycle_status is %, not in_repair', v_from_lifecycle
        USING ERRCODE = 'P0001';
    END IF;

    IF v_from_stage = 'final_inspection' THEN
      RAISE EXCEPTION 'final_inspection is the last stage; use the complete action instead'
        USING ERRCODE = 'P0001';
    END IF;

    v_current_index := array_position(v_stages, v_from_stage);
    v_next_stage := v_stages[v_current_index + 1];

    UPDATE repair_orders
    SET primary_repair_stage = v_next_stage
    WHERE id = p_repair_order_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'reject_to_stage' THEN
    IF v_from_lifecycle <> 'in_repair' THEN
      RAISE EXCEPTION 'cannot reject_to_stage: lifecycle_status is %, not in_repair', v_from_lifecycle
        USING ERRCODE = 'P0001';
    END IF;

    IF p_target_stage IS NULL THEN
      RAISE EXCEPTION 'reject_to_stage requires p_target_stage'
        USING ERRCODE = 'P0001';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
      RAISE EXCEPTION 'reject_to_stage requires a non-empty p_reason'
        USING ERRCODE = 'P0001';
    END IF;

    -- Relies on enum declaration order: '<' means "earlier in the sequence".
    IF p_target_stage >= v_from_stage THEN
      RAISE EXCEPTION 'reject_to_stage target (%) must be earlier than current stage (%)',
        p_target_stage, v_from_stage
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE repair_orders
    SET primary_repair_stage = p_target_stage
    WHERE id = p_repair_order_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'complete' THEN
    IF v_from_lifecycle <> 'in_repair' OR v_from_stage <> 'final_inspection' THEN
      RAISE EXCEPTION 'complete requires lifecycle_status=in_repair and stage=final_inspection (got % / %)',
        v_from_lifecycle, v_from_stage
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE repair_orders
    SET lifecycle_status = 'completed',
        primary_repair_stage = NULL
    WHERE id = p_repair_order_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'deliver' THEN
    IF v_from_lifecycle <> 'completed' THEN
      RAISE EXCEPTION 'cannot deliver: lifecycle_status is %, not completed', v_from_lifecycle
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE repair_orders
    SET lifecycle_status = 'delivered'
    WHERE id = p_repair_order_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'cancel' THEN
    IF v_from_lifecycle NOT IN ('intake', 'in_repair') THEN
      RAISE EXCEPTION 'cannot cancel from lifecycle_status %', v_from_lifecycle
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE repair_orders
    SET lifecycle_status = 'cancelled',
        primary_repair_stage = NULL
    WHERE id = p_repair_order_id
    RETURNING * INTO v_row;

  ELSE
    RAISE EXCEPTION 'unknown transition action: %', p_action
      USING ERRCODE = 'P0001';
  END IF;

  -- ADJUST: match your real transition-history table/columns here.
  -- This assumes repair_order_transitions(repair_order_id, actor_id, action,
  -- from_lifecycle_status, from_primary_stage, to_lifecycle_status,
  -- to_primary_stage, reason, created_at).
  INSERT INTO repair_order_transitions (
    repair_order_id, actor_id, action,
    from_lifecycle_status, from_primary_stage,
    to_lifecycle_status, to_primary_stage,
    reason, created_at
  ) VALUES (
    p_repair_order_id, p_actor_id, p_action,
    v_from_lifecycle, v_from_stage,
    v_row.lifecycle_status, v_row.primary_repair_stage,
    p_reason, now()
  );

  RETURN v_row;
END;
$$;

COMMIT;

-- ---------------------------------------------------------------------------
-- POST-MIGRATION: run this to find rows that need manual stage correction
-- (see the backfill note in step 3 above).
-- ---------------------------------------------------------------------------
-- SELECT id, organisation_id, ro_number, legacy_status, lifecycle_status, primary_repair_stage
-- FROM repair_orders
-- WHERE legacy_status = 'in_progress';
