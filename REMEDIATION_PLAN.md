# WorkShopOS Remediation Plan

**Source:** `BUILD_STATUS.md` audit  
**Date:** 2026-09-05  
**Current maturity:** EARLY DEVELOPMENT

## Purpose

This plan converts the verified findings in `BUILD_STATUS.md` into an ordered remediation backlog. Work must proceed in dependency order. No item should be marked complete without repository or runtime verification.

## Execution Rules

1. Remediate one item at a time.
2. Do not expand scope while an earlier blocking item remains unresolved.
3. After each remediation: run the relevant tests, typecheck, lint, and build where applicable.
4. Update `BUILD_STATUS.md` after each major remediation/verification phase.
5. Commit each coherent remediation when the repository workflow permits.
6. Do not claim PostgreSQL/Supabase compatibility from mocked unit tests or migration-text tests.
7. Keep the authoritative documents synchronized with the actual implementation.

---

# Priority 0 — Blocking Foundation

## REM-001 — Reconcile Repair-Order Database Lifecycle Model

**Priority:** CRITICAL  
**Status:** BLOCKED / NEXT ITEM  
**Area:** Database / Repair Order Workflow

### Finding

The application layer has been aligned to `lifecycle_status` and `primary_repair_stage`, but the migration chain still contains conflicting repair-order workflow models.

The audit identifies:
- both the older status-transition slice and newer lifecycle migration;
- transition-history column incompatibilities;
- incompatible `transition_repair_order` RPC signatures;
- a route RPC parameter object that matches neither migration-defined signature.

### Affected evidence

- `supabase/migrations/20260901000005_repair_order_transition_slice.sql`
- `supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql`
- `app/api/v1/repair-orders/[id]/transition/route.ts`

### Required remediation

Establish **one canonical repair-order lifecycle model** and align:
- repair-order columns;
- transition-history schema;
- RPC/function signature;
- transition route;
- lifecycle reads/writes;
- migration ordering;
- related tests.

Do not add new workflow functionality until this contract is stable.

### Acceptance criteria

- One final, internally consistent lifecycle schema is defined.
- Migration history can be applied cleanly in order.
- Transition-history columns match the lifecycle transition implementation.
- RPC signature exactly matches the route invocation.
- Application reads/writes match the final schema.
- No obsolete conflicting lifecycle contract remains.
- PostgreSQL/Supabase execution verifies the complete migration and transition path.

### Verification

- Apply migrations against a disposable/test PostgreSQL/Supabase environment.
- Execute lifecycle transitions against the real database function.
- Run focused transition tests.
- Run integration tests.
- Run typecheck, lint, and build.

---

## REM-002 — Verify Repair-Order Lifecycle End-to-End

**Priority:** CRITICAL  
**Status:** BLOCKED BY REM-001  
**Area:** Workflow / Integration Testing

### Finding

The route tests mock the Supabase RPC and therefore do not prove that the SQL state machine and transition-history write work.

No verified full workflow E2E flow exists.

### Required remediation

Create a real integration path covering:

`create repair order → read → transition → verify lifecycle state → verify primary stage → verify transition history`

### Acceptance criteria

A real PostgreSQL/Supabase test demonstrates that the complete repair-order lifecycle works without mocks at the database boundary.

### Verification

- Integration test against live local/test Supabase.
- Verify database state and transition-history rows.
- Add E2E coverage once the application UI supports the workflow.

---

# Priority 1 — Security and Authorization

## REM-003 — Complete Runtime RBAC Enforcement

**Priority:** CRITICAL  
**Status:** INCOMPLETE  
**Area:** RBAC / Security

### Finding

The RBAC service contains incomplete enforcement:
- `canAssignRole()` has a future-enhancement placeholder.
- `getRoleAssignments()`, `getEffectivePermissions()`, and `assertPermission()` pass an always-true membership callback into the tenant boundary.
- `assignRole()` and `removeRole()` use the service-role client and rely on callers to authorize them.
- No self-contained role-management authorization guard is present.

### Affected evidence

- `src/server/services/rbac-engine.ts`
- `supabase/migrations/20260830000002_rbac_foundation.sql`
- `tests/integration/rbac-permissions.test.ts`

### Required remediation

Implement and verify the documented tenant-aware RBAC enforcement model before expanding protected business features.

### Acceptance criteria

- Organisation membership is independently validated.
- Branch restrictions are enforced.
- Permission checks cannot be bypassed through service-role operations.
- Role assignment/removal is protected by explicit authorization.
- Tests cover allowed and denied cases.

### Verification

- Unit tests.
- Integration tests against live/test Supabase.
- Tenant-isolation tests.
- Negative authorization tests.

---

## REM-004 — Verify Authentication and Tenant Isolation Against Live Supabase

**Priority:** HIGH  
**Status:** INCOMPLETE  
**Area:** Authentication / Multi-tenancy

### Finding

Auth/session and tenant-context utilities exist, but full runtime verification has not been performed.

### Required remediation

Run the authentication and tenant-context flows against a real local/test Supabase environment.

### Acceptance criteria

- Login/session handling works.
- Tenant membership is validated.
- Organisation switching is constrained to authorized memberships.
- Branch switching is constrained correctly.
- Protected routes reject unauthenticated users.
- Tenant isolation is demonstrated through live tests.

---

# Priority 2 — API Contract Integrity

## REM-005 — Align API Error Contract

**Priority:** HIGH  
**Status:** INCOMPLETE  
**Area:** API

### Finding

Auth and tenant routes return ad-hoc string errors instead of the documented structured error contract containing an error code and request ID.

### Affected evidence

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/v1/auth-protected/route.ts`
- tenant-context routes
- `API_CONTRACTS.md`

### Required remediation

Align affected API routes with the documented structured error response contract.

### Acceptance criteria

- Errors have consistent machine-readable codes.
- Request/correlation IDs are returned as required by the contract.
- HTTP status codes are consistent with the documented semantics.
- Tests cover representative failure modes.

---

## REM-006 — Re-Audit Repair-Order API Against Final Database Contract

**Priority:** HIGH  
**Status:** BLOCKED BY REM-001  
**Area:** API / Repair Orders

### Required remediation

After REM-001, revalidate:
- create;
- list;
- get;
- update;
- archive;
- transition.

### Acceptance criteria

Every route uses the canonical lifecycle schema and database contract, with no legacy `status` references where the final model no longer supports them.

---

# Priority 3 — Quality and CI

## REM-007 — Fix Vitest Configuration Duplication

**Priority:** MEDIUM  
**Status:** OPEN  
**Area:** Tooling

### Finding

`vitest.config.mjs` contains a duplicated `exclude` property.

### Acceptance criteria

- Duplicate configuration is removed.
- Test discovery remains unchanged or is intentionally documented.
- Full test suite passes.

---

## REM-008 — Add Minimal GitHub Actions CI

**Priority:** HIGH  
**Status:** MISSING  
**Area:** CI/CD

### Finding

No `.github` CI workflow was found, although the architecture identifies GitHub Actions as the CI/CD target.

### Required remediation

Add a minimal CI pipeline that verifies the repository's engineering gates.

### Acceptance criteria

CI runs at minimum:
- install;
- lint;
- typecheck;
- tests;
- production build.

Do not add deployment automation until deployment requirements are verified.

---

## REM-009 — Plan and Execute Middleware-to-Proxy Migration

**Priority:** MEDIUM  
**Status:** OPEN  
**Area:** Next.js Infrastructure

### Finding

The build reports that the `middleware` convention is deprecated in favor of `proxy`.

### Required remediation

Determine the required Next.js 16 migration and move the relevant behavior without changing security semantics.

### Acceptance criteria

- Deprecation warning is removed.
- Auth/tenant behavior remains unchanged.
- Relevant tests pass.
- Build remains clean.

---

# Priority 4 — Documentation Governance

## REM-010 — Synchronize AGENTS.md With Actual Tooling

**Priority:** MEDIUM  
**Status:** OPEN  
**Area:** Documentation

### Finding

`AGENTS.md` says there is no `npm run test` script, while `package.json` defines `test`, `test:integration`, `test:watch`, and `test:coverage`.

### Acceptance criteria

`AGENTS.md` accurately describes the current scripts and engineering workflow.

---

## REM-011 — Replace Generic README

**Priority:** LOW  
**Status:** OPEN  
**Area:** Documentation

### Finding

`README.md` remains generic Next.js starter documentation.

### Acceptance criteria

README describes WorkShopOS, its purpose, architecture at a high level, development setup, available scripts, and verification workflow.

---

## REM-012 — Create CHANGELOG.md

**Priority:** LOW  
**Status:** MISSING  
**Area:** Documentation

### Acceptance criteria

Create a concise chronological record of significant verified changes without duplicating the detailed project status report.

---

## REM-013 — Reconcile Documentation Checklists With Implementation Evidence

**Priority:** MEDIUM  
**Status:** OPEN  
**Area:** Governance

### Finding

Some roadmap/documentation checklists describe intended or partial work more positively than current implementation evidence supports.

### Acceptance criteria

Authoritative documents clearly distinguish:
- implemented;
- partially implemented;
- planned;
- blocked;
- verified.

---

# Priority 5 — Core Product Implementation

These items must remain behind the database/security foundation.

## REM-014 — Build Repair-Order Detail View

**Priority:** HIGH  
**Status:** NOT IMPLEMENTED  
**Depends on:** REM-001, REM-006

### Required scope

Implement the repair-order detail experience with:
- lifecycle status;
- primary repair stage;
- workflow controls;
- transition history;
- appropriate loading/error states.

### Acceptance criteria

The UI reads real repair-order data and can perform only authorized valid transitions.

---

## REM-015 — Add Repair-Order Creation UI

**Priority:** HIGH  
**Status:** NOT IMPLEMENTED  
**Depends on:** REM-001, REM-006

### Acceptance criteria

A validated form can create a repair order through the documented API and displays meaningful validation/error feedback.

---

## REM-016 — Add Repair-Order Pagination and List States

**Priority:** MEDIUM  
**Status:** INCOMPLETE  
**Depends on:** REM-006

### Required scope

Add:
- pagination controls;
- loading state;
- error state;
- empty state;
- appropriate query/filter behavior.

---

## REM-017 — Implement the Eight-Stage Repair Workflow UI

**Priority:** HIGH  
**Status:** NOT IMPLEMENTED  
**Depends on:** REM-001, REM-014

### Canonical stages

1. Disassembly
2. Parts Ordering
3. Panel Beating
4. Paint Preparation
5. Painting
6. Assembly
7. Outwork/Polishing
8. Final Inspection

### Acceptance criteria

The UI represents the canonical stage model and respects the single-primary-stage rule and documented transition rules.

---

# Priority 6 — Remaining WorkShopOS Domain

These should be planned only after the repair-order foundation is verified.

## REM-018 — Customer Module

**Priority:** HIGH  
**Status:** NOT IMPLEMENTED**

Implement only after confirming the domain model and API contract.

---

## REM-019 — Vehicle Module

**Priority:** HIGH  
**Status:** NOT IMPLEMENTED**

Integrate with customer and repair-order relationships according to the authoritative database/API documents.

---

## REM-020 — Estimates Module

**Priority:** MEDIUM  
**Status:** NOT IMPLEMENTED**

Define/implement only from the authoritative product and database requirements.

---

## REM-021 — Invoices Module

**Priority:** MEDIUM  
**Status:** NOT IMPLEMENTED**

Define/implement only from the authoritative product and database requirements.

---

# Priority 7 — Operational UI and Deployment

## REM-022 — Replace Static Dashboard Metrics

**Priority:** MEDIUM  
**Status:** INCOMPLETE

### Finding

Dashboard values such as `Online`, `Active`, and `Review queue` are static placeholders.

### Acceptance criteria

Dashboard metrics are backed by real data and respect tenant/branch permissions.

---

## REM-023 — Resolve Missing `/settings` Route

**Priority:** LOW  
**Status:** OPEN

### Finding

`Workshop settings` navigation points to `/settings`, but no matching route was found.

### Acceptance criteria

Either implement the intended settings route or remove/redirect the navigation item according to the product requirements.

---

## REM-024 — Production Deployment Configuration

**Priority:** HIGH  
**Status:** UNVERIFIED

### Finding

No verified production deployment configuration was found.

### Acceptance criteria

Document and verify the intended deployment architecture, environment variables, database configuration, and production build/start process.

---

# Final Verification Gate

WorkShopOS should not be classified as production-ready until all of the following are verified:

- [ ] Canonical repair-order lifecycle schema
- [ ] Migration chain executes cleanly
- [ ] Lifecycle RPC works against PostgreSQL
- [ ] Transition history works against PostgreSQL
- [ ] Repair-order API matches database contract
- [ ] Live authentication verification
- [ ] Live tenant isolation verification
- [ ] Complete RBAC enforcement
- [ ] Structured API error contract
- [ ] Full test suite passing
- [ ] Integration lifecycle tests passing
- [ ] E2E repair-order workflow passing
- [ ] CI pipeline passing
- [ ] No unresolved critical/high security defects
- [ ] Documentation matches implementation
- [ ] Production deployment is verified

# Recommended Execution Order

| Order | ID | Work | Priority | Dependency |
|---:|---|---|---|---|
| 1 | REM-001 | Reconcile repair-order DB lifecycle | CRITICAL | — |
| 2 | REM-002 | Verify lifecycle end-to-end | CRITICAL | REM-001 |
| 3 | REM-003 | Complete RBAC enforcement | CRITICAL | — |
| 4 | REM-004 | Verify auth/tenant isolation | HIGH | REM-003 |
| 5 | REM-005 | Align API error contract | HIGH | — |
| 6 | REM-006 | Re-audit repair-order API | HIGH | REM-001 |
| 7 | REM-007 | Fix Vitest configuration | MEDIUM | — |
| 8 | REM-008 | Add CI | HIGH | — |
| 9 | REM-009 | Middleware → proxy migration | MEDIUM | — |
| 10 | REM-010 | Synchronize AGENTS.md | MEDIUM | — |
| 11 | REM-013 | Reconcile documentation | MEDIUM | REM-001–006 |
| 12 | REM-014 | Repair-order detail UI | HIGH | REM-001, 006 |
| 13 | REM-015 | Repair-order creation UI | HIGH | REM-001, 006 |
| 14 | REM-016 | Repair-order list states | MEDIUM | REM-006 |
| 15 | REM-017 | Eight-stage workflow UI | HIGH | REM-001, 014 |
| 16 | REM-022 | Data-backed dashboard | MEDIUM | Core API |
| 17 | REM-018 | Customer | HIGH | Domain model |
| 18 | REM-019 | Vehicle | HIGH | Customer/domain model |
| 19 | REM-020 | Estimates | MEDIUM | Core domain |
| 20 | REM-021 | Invoices | MEDIUM | Core domain |
| 21 | REM-024 | Production deployment | HIGH | Verification |

# AI Coding Guardrail

For each remediation item, instruct the coding agent:

> Implement only the specified remediation item. Do not fix unrelated findings. Inspect the existing implementation before changing it. Preserve the authoritative WorkShopOS architecture and contracts. After implementation, run the required verification commands and report exactly what passed and failed. Do not claim database compatibility unless the database operation was actually executed.

# Current Next Action

**Start with REM-001 only.**

Do not proceed to UI workflow development until the repair-order migration chain, transition-history schema, RPC signature, route invocation, and integration tests agree on one verified canonical lifecycle contract.
