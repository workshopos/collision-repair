# WorkShopOS — Sprint Plan (Post-Audit)

Derived directly from the audit's Priority 1–3 items and effort estimates.
Assumes **one engineer, ~20 focused hours/week**. Adjust pacing if you have
more/less time; the *order* of items matters more than the week boundaries —
don't start Priority 2 work before Priority 1 is done, since P2 items build
on the RBAC/state-machine decisions made in P1.

---

## Sprint 1 (Week 1) — Unblock Production Path
**Goal:** resolve everything currently blocking correctness/security.
**Total estimated effort:** 7–13 hours (fits comfortably in one week)

| Day | Task | Est. | Depends on |
|-----|------|------|------------|
| Mon | **1.3 — Decide + fix state machine spec drift.** Meet/decide: update PRD to match 6 implemented states, or implement the 8-stage spec. Do this *first* — it determines what RBAC permission checks and RLS tests below need to assume. | 1–4h | — |
| Tue | **1.1 — Implement `assertPermission()`** in `rbac-engine.ts`. Wire real permission checks into repair-order routes. Unmock in at least the repair-order-transition test to confirm it actually blocks unauthorized users. | 2–3h | 1.3 (if states changed, permission keys may need updating) |
| Wed–Thu | **1.2 — Verify RLS with integration tests.** Set up local Supabase (`supabase start`), apply migrations, run cross-org/cross-branch isolation tests. Fix any policy gaps found. | 4–6h | — (can run in parallel with 1.1) |
| Fri | Buffer / fix whatever 1.1–1.2 turned up. Run full suite (`test`, `test:integration`, `lint`, `typecheck`, `build`). Commit. | — | 1.1, 1.2 |

**Exit criteria for Sprint 1:** RBAC actually denies unauthorized access (proven by an unmocked test), RLS cross-org isolation is proven by a real integration test (not assumed), and the state machine matches whatever the PRD now says. This is the "safe to keep building on" checkpoint — don't proceed to Sprint 2 until this is true.

---

## Sprint 2 (Week 2) — Make Repair Orders Actually Usable
**Goal:** repair orders go from "API only" to "a person can use this feature."
**Total estimated effort:** 18–28 hours

| Day | Task | Est. |
|-----|------|------|
| Mon–Tue | **2.1 — Complete repair-order service layer.** Add `getRepairOrder()`, `createRepairOrder()`, `updateRepairOrder()`, `archiveRepairOrder()`, `transitionRepairOrder()`. Route handlers should call the service, not touch Supabase directly (per your own ARCHITECTURE.md). | 4–6h |
| Wed–Thu–Fri | **2.2 — Repair-order UI.** List view + pagination, detail page, edit form, transition workflow. This is the largest single item — if it's running long, ship list + detail first and treat edit/transition UI as spillover into Sprint 3. | 8–12h |
| (spillover) | **2.3 — App shell navigation.** Sidebar, mobile nav, user menu, org/branch switcher. If Sprint 2 is full, this can move to the start of Sprint 3 — it's independent of 2.1/2.2. | 6–10h |

**Exit criteria:** a real user can log in, see a list of repair orders scoped to their org/branch, open one, edit it, and transition its state — through the UI, not curl/Postman.

---

## Sprint 3 (Week 3) — Cleanup + Foundation for Stage 11
**Goal:** close out remaining medium-priority debt, then start Customers.
**Total estimated effort:** 8–11 hours of P3 work + start of Stage 11

| Day | Task | Est. |
|-----|------|------|
| Mon | Finish any 2.2/2.3 spillover from Sprint 2. | — |
| Tue | **3.1 — Remove remaining RBAC test mocks**, now that enforcement is real (should mostly already be done from Sprint 1 day 2 — this is the final sweep). | 2–3h |
| Tue | **3.3 — Lint fix** (unused import). Trivial, do it same day. | 5 min |
| Wed–Thu | **3.2 — Audit logging.** Audit event table + service, logging create/update/archive/transition. | 6–8h |
| Fri | Retro: confirm Priority 1–3 checklist is fully closed. Kick off **Stage 11 (Customer database)** design — schema + migration draft, so Sprint 4 can start writing code on day 1 instead of designing. | — |

**Exit criteria:** the audit's full Priority 1–3 checklist is closed, `npm run test`, `test:integration`, `lint`, `typecheck`, and `build` are all clean, and you have a migration draft ready for the Customers module.

---

## After Sprint 3: Resume the 40-Stage Roadmap
With Priority 1–3 closed, Stages 11–17 (Customers, Vehicles) become the next
sequential block — same pattern as repair orders: database → service →
API → UI, each with real (non-mocked) tests for anything security-relevant.

## Notes on sequencing risk
- **Don't parallelize 1.1 and 1.3** if state-machine changes affect permission
  keys (e.g. a new `repair_order.transition_to_qc` permission) — decide 1.3
  first thing Monday.
- **1.2 (RLS tests) has the widest time variance** (4–6h) because most of it
  is environment setup, not test-writing. If `supabase start` is already a
  habit for you, this could be 2–3h; if this is the first time standing up
  local Supabase for the project, budget the full 6h.
- **2.2 (repair-order UI) is the single largest risk to the week-1/week-2
  cadence.** If your team has an existing design system/component library
  beyond shadcn primitives, this shrinks a lot; if you're designing list/detail
  layouts from scratch, treat the 8–12h estimate as optimistic.
