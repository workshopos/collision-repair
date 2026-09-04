# ADR-0002: Repair Order Lifecycle & Primary Repair Stage Model

**Status:** Proposed
**Date:** 2026-09-03
**Related:** PRD Stage 18 (Repair Order Database), Migration `20260901000005_repair_order_transition_slice.sql` (to be superseded), ADR-0001 (RBAC contract decisions)

---

## Context

PRD Stage 18 defines eight **primary repair stages**, authoritative in name and order, and states explicitly:

> *"These stage names and their order are authoritative... Do not rename, reorder, remove, or invent primary repair stages without an explicit PRD change."*
> *"Every repair order has one and only one primary repair stage at a time."*

The eight stages are: `Disassembly`, `Parts Ordering`, `Panel Beating`, `Paint Preparation`, `Painting`, `Assembly`, `Outwork/Polishing`, `Final Inspection`.

The current implementation (migration `007`, transition route handler) instead uses a flat six-value `status` enum: `intake`, `diagnosis`, `in_progress`, `completed`, `delivered`, `cancelled`. This does not contain the eight authoritative stage names at all — it is not a reordering or renaming of the PRD's stages, it's a different (non-conformant) model entirely. This is a documented spec-drift finding from the September 2026 project audit.

Two problems must be solved simultaneously:

1. **Conformance** — the eight stage names and order must appear verbatim in the schema, state machine, API, and UI, per the PRD's explicit constraint.
2. **Coverage** — the PRD's own stage list only covers the *in-repair* portion of a vehicle's time at the shop. The PRD separately requires "intake information" to be captured, and the shop's broader lifecycle plainly includes states before Disassembly (the vehicle has been received but repair hasn't started) and after Final Inspection (the vehicle has been handed back, or the RO was cancelled before or during repair). None of these fit inside the eight-stage list, and the PRD does not instruct us to invent additional *primary repair stages* to cover them — it explicitly forbids inventing additional primary stages.

This means a single flat enum containing only the eight stage values cannot represent the full lifecycle without either (a) violating the "do not invent additional primary stages" rule by adding `intake`/`delivered`/`cancelled` *into* that same enum, or (b) leaving intake/delivery/cancellation unrepresentable.

## Decision

Model the repair order's status using **two separate fields** rather than one flat enum:

| Field | Type | Values | Meaning |
|---|---|---|---|
| `lifecycle_status` | enum | `intake`, `in_repair`, `completed`, `delivered`, `cancelled` | The RO's broad position in the shop's overall workflow. |
| `primary_repair_stage` | enum, nullable | `disassembly`, `parts_ordering`, `panel_beating`, `paint_preparation`, `painting`, `assembly`, `outwork_polishing`, `final_inspection` | The single authoritative PRD stage, in effect **only** while `lifecycle_status = 'in_repair'`. |

This keeps the eight PRD stage values untouched, unrenamed, unreordered, and uninflated — they exist in their own dedicated column, exactly as specified. The broader shop lifecycle (which the PRD's "intake information," "estimated completion date," and general RO concept clearly presuppose) is handled by a separate field that the PRD does not constrain.

**Constraint enforcing "one and only one primary stage at a time":**

```sql
CONSTRAINT repair_orders_stage_lifecycle_check CHECK (
  (lifecycle_status = 'in_repair'  AND primary_repair_stage IS NOT NULL) OR
  (lifecycle_status <> 'in_repair' AND primary_repair_stage IS NULL)
)
```

This guarantees `primary_repair_stage` is populated exactly when it's meaningful, and is otherwise `NULL` — never ambiguous, never "one of several."

**Transition rules:**

- `intake → in_repair`: sets `primary_repair_stage = 'disassembly'` (the first stage). This is the only valid entry point into the repair stages — an RO cannot jump into the middle of the stage sequence.
- Within `in_repair`, `primary_repair_stage` advances **strictly in the PRD's given order**, one step at a time, via an explicit transition action (no skipping ahead).
- **Rework/rejection:** a stage may be rejected back to an *earlier* stage (not necessarily only the immediately preceding one — e.g. a paint failure discovered at Final Inspection may need to go back to Panel Beating, not just Painting) via a distinct, explicitly-named action (e.g. `reject_to_stage`), never as a silent side effect of a forward transition. Every rejection must be logged with a reason, using the existing transition-history mechanism.
- `Final Inspection → in_repair` completing successfully transitions `lifecycle_status → completed`, `primary_repair_stage → NULL`.
- `completed → delivered` on handover to customer.
- `cancelled` is reachable from `intake` or `in_repair` (any stage), never from `completed`/`delivered`.

**Open question requiring confirmation before implementation:** this ADR assumes rework/rejection back to an earlier stage is a real business need (collision repair shops routinely fail QC and send work back). If the business rule is actually that stages are strictly forward-only and irreversible once passed, the `reject_to_stage` action should be removed from the RPC and this ADR updated accordingly. **This should be confirmed with whoever owns the PRD before the migration is written**, since it materially changes the transition RPC's validation logic.

## Consequences

**Positive:**
- Satisfies the PRD's stage-name/order requirement literally and exactly — no renaming, reordering, or invention.
- Satisfies "one and only one primary stage at a time" via a DB-level CHECK constraint, not just application logic.
- Intake, delivery, and cancellation — none of which are primary repair stages — remain representable without polluting the authoritative stage list.
- Reporting queries like "how long was this RO in Painting" or "how many ROs are currently in Parts Ordering" become simple, indexed queries on `primary_repair_stage` alone, without needing to filter out intake/delivered/cancelled noise first.
- RBAC/permission checks that are stage-specific (e.g. "only a painter role can move an RO out of Painting") can key off `primary_repair_stage` directly.

**Negative / trade-offs:**
- Two fields instead of one is marginally more complex than a flat enum — every place that currently reads a single `status` column needs updating to consider both fields (or a computed convenience view/column, see below).
- The transition RPC's validation logic is more involved than a simple "is target in allowed-next-set" check, since it must handle: intake→in_repair (special-cased entry), sequential advancement, rework/rejection to an arbitrary earlier stage, and completion/delivery/cancellation as separate lifecycle transitions.
- Any existing code, tests, or UI built against the old 6-value `status` enum needs rewriting, not just extending — this is a breaking schema change, not additive.

**Mitigation for the two-field complexity:** consider adding a generated/computed column or view, e.g. `display_status`, that concatenates the two fields for simple list-view rendering (`"In Repair — Painting"`, `"Delivered"`, etc.), so most UI code only ever reads one human-readable value and the two-field split stays an implementation detail of the backend/DB layer.

## Alternatives Considered

**A. Single flat enum with 8 PRD stages + intake/delivered/cancelled folded in as extra values (e.g. `intake`, `disassembly`, ..., `final_inspection`, `delivered`, `cancelled`).**
Rejected: this technically satisfies "don't rename/reorder the 8 stages" but arguably still violates "do not invent additional primary stages," since `intake`/`delivered`/`cancelled` would then read as primary stages sitting in the same authoritative list, when the PRD frames them as lifecycle bookends, not repair stages. It also makes the CHECK-constraint-based "one and only one primary stage" guarantee harder to express (you'd need to exclude the non-stage values from that particular invariant).

**B. Keep a single `status` text field with no stage enum at all, validate only in application code.**
Rejected: the audit specifically flagged "database constraints preventing invalid state values" as a PRD requirement (Stage 18). Application-only validation doesn't satisfy that, and doesn't protect against direct DB writes (e.g. via Supabase admin tools, scripts, or future services that bypass the API layer).

## Next Steps

1. Confirm the rework/rejection open question above with the PRD owner.
2. Draft migration replacing `007` (or superseding it with a new migration): `lifecycle_status` enum, `primary_repair_stage` enum, CHECK constraint, indexes on `(organisation_id, branch_id, lifecycle_status)` and `(organisation_id, primary_repair_stage)`, and RLS policy updates if policies currently reference the old `status` column.
3. Rewrite the transition RPC (`transition_repair_order`) to implement the rules above.
4. Update Zod schemas, TypeScript types, route handler, and any stage-specific RBAC permission keys.
5. Update `DATABASE.md` and `PRD.md` (or an amendment note) to reflect this two-field model, since the PRD as written describes only the stage list, not the surrounding lifecycle — this ADR is the record of that gap-filling decision.
