# WorkShopOS Final Audit Report

**Date:** 2026-09-04
**Audit status:** Complete repository audit
**Maturity:** Early development
**Scope:** Project documentation, configuration, database migrations, authentication, tenant isolation, RBAC, API routes, frontend, workflow implementation, and available verification evidence.

## Executive Summary

WorkShopOS contains a credible Next.js, Supabase, authentication, tenant, RBAC, and repair-order foundation. It is not yet a complete or production-ready autobody repair platform.

The most important risks are:

1. The repair-order migration chain has incompatible status, lifecycle, RPC, and transition-history contracts.
2. RBAC service helpers do not independently enforce tenant membership, and privileged role mutation helpers rely on callers to authorize them.
3. The frontend is still a shell: the dashboard is static, repair orders are read-only, and settings navigation points to a missing route.
4. The documented API error contract is not implemented consistently.
5. CI/deployment configuration is absent, documentation is partly stale, and the framework reports a deprecated middleware convention.

The current verification baseline is positive but limited:

- `npm run test`: 19 test files and 139 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run lint`: 0 errors and 1 warning.
- Recorded integration output: 2 files passed, 7 tests passed, and 1 todo for the available RLS/RBAC integration run.

Passing unit tests and a successful build do not resolve the migration and workflow contract defects identified below.

## 1. Findings

### Critical: Repair-order migration and API contracts are incompatible

Evidence:

- [supabase/migrations/20260901000001_repair_orders_read_slice.sql](supabase/migrations/20260901000001_repair_orders_read_slice.sql) creates `repair_orders.status`.
- [supabase/migrations/20260901000005_repair_order_transition_slice.sql](supabase/migrations/20260901000005_repair_order_transition_slice.sql) creates a status-based transition RPC and a transition table with `from_status` and `to_status`.
- [supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql](supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql) renames `status` to `legacy_status`, adds lifecycle/stage columns, defines a different RPC signature, and inserts transition-history columns not created by the earlier table migration.
- [app/api/v1/repair-orders/[id]/transition/route.ts](app/api/v1/repair-orders/[id]/transition/route.ts) sends RPC parameters that match neither migration-defined signature.
- [src/server/services/repair-orders.ts](src/server/services/repair-orders.ts) and the non-transition repair-order routes still select `status`.

Impact:

- A clean application of the migration chain and execution through the current API are not demonstrated as compatible.
- Workflow state and history cannot be treated as one canonical source of truth.

Recommendation:

- Select one lifecycle model, create a forward migration from the current schema, align all RPCs, history columns, services, routes, and tests, and execute the resulting chain against PostgreSQL.

### High: RBAC service boundary has authorization gaps

Evidence:

- [src/server/services/rbac-engine.ts](src/server/services/rbac-engine.ts) passes `async () => true` as the membership callback when resolving role assignments and effective permissions.
- `assignRole()` and `removeRole()` use the service-role client without requiring or deriving an authorized actor.
- `canAssignRole()` contains an explicit placeholder for the rule preventing actors from granting permissions they do not possess.

Impact:

- Direct service callers can bypass the service-level tenant membership boundary if they supply another organisation ID.
- Role mutation safety depends on every caller performing checks correctly.

Recommendation:

- Make tenant membership and actor authorization mandatory inside the service boundary. Validate target membership, role scope, branch scope, permission containment, and audit requirements before privileged writes.

### High: Workflow behavior is not proven against PostgreSQL

Evidence:

- [tests/unit/repair-order-transition.test.ts](tests/unit/repair-order-transition.test.ts) mocks the Supabase RPC.
- [tests/unit/repair-order-transition-migration.test.ts](tests/unit/repair-order-transition-migration.test.ts) checks SQL text rather than executing migrations or the RPC.
- No verified full workflow end-to-end test exists.

Impact:

- State ordering, row locking, transition-history writes, RPC signatures, and database error behavior remain unproven.

Recommendation:

- Add a real Supabase/PostgreSQL integration suite for the canonical migration and exercise the transition endpoint with valid, invalid, concurrent, archived, and tenant-mismatch cases.

### High: Frontend does not implement the operational workflow

Evidence:

- [app/(authenticated)/page.tsx](<app/(authenticated)/page.tsx>) renders static values such as `Online`, `Active`, and `Review queue`.
- [app/(authenticated)/repair-orders/page.tsx](<app/(authenticated)/repair-orders/page.tsx>) renders a read-only table.
- No repair-order detail, create, edit, or transition controls were found.
- [src/components/layout/app-shell.tsx](src/components/layout/app-shell.tsx) links to `/settings`, but no matching route exists.

Impact:

- The current UI cannot support the core repair-order workflow or provide data-backed operational visibility.
- Users can be sent to a dead route.

Recommendation:

- Stabilize the data model first, then implement repair-order detail, workflow controls, loading/error states, pagination, and a deliberate settings route.

### Medium: API error contract is inconsistent

Evidence:

- [API_CONTRACTS.md](API_CONTRACTS.md) requires structured errors containing `code`, `message`, `request_id`, and optional `details`.
- Auth, tenant-context, and repair-order routes return plain string payloads such as `{ error: "Forbidden" }` and `{ error: message }`.

Impact:

- API clients cannot depend on a stable machine-readable error format.
- Internal membership or validation messages may be exposed directly.

Recommendation:

- Introduce one shared error-response helper and map authentication, validation, authorization, not-found, conflict, and internal failures to the documented contract.

### Medium: Documentation and delivery configuration drift

Evidence:

- [AGENTS.md](AGENTS.md) says no test script exists, while [package.json](package.json) defines test scripts.
- [README.md](README.md) remains the create-next-app starter guide.
- [vitest.config.mjs](vitest.config.mjs) declares `exclude` twice.
- No `.github` CI workflow was found, while [ARCHITECTURE.md](ARCHITECTURE.md) names GitHub Actions as the CI/CD target.
- `npm run build` reports that the `middleware` convention is deprecated in favor of `proxy`.

Recommendation:

- Update stale instructions, remove duplicated configuration, add a minimal CI workflow, and schedule the middleware migration.

## 2. Verified Implementation

### Project foundation

- Next.js 16.3.3, React 19.2.8, TypeScript, Tailwind, ESLint, and Vitest are configured in [package.json](package.json).
- Strict TypeScript mode and the `@/*` path alias are configured in [tsconfig.json](tsconfig.json).
- Environment templates and server-only service-role configuration exist in [.env.example](.env.example) and [src/lib/auth/config.ts](src/lib/auth/config.ts).
- Environment files and generated build/test artifacts are excluded in [.gitignore](.gitignore).

### Authentication and tenant context

- Supabase server/browser clients and session helpers exist under [src/lib/auth](src/lib/auth).
- Login and logout handlers exist under [app/api/auth](app/api/auth).
- Tenant validation and membership checks exist in [src/server/services/tenant-context.ts](src/server/services/tenant-context.ts).
- Active organisation/branch context is stored in an HttpOnly cookie and revalidated against membership data by [src/server/services/active-tenant-context.ts](src/server/services/active-tenant-context.ts).

### Database and RLS foundation

- Identity, organisation, branch, profile, and membership tables are defined in [20260830000001_identity_tenant_foundation.sql](supabase/migrations/20260830000001_identity_tenant_foundation.sql).
- Roles, permissions, role mappings, and user assignments are defined in [20260830000002_rbac_foundation.sql](supabase/migrations/20260830000002_rbac_foundation.sql).
- RLS policies and tenant-aware indexes exist for the implemented tables.
- [rls-test-output.txt](rls-test-output.txt) records an integration run with 2 files passed, 7 tests passed, and 1 todo. This is partial evidence, not proof of the complete migration chain.

### API and repair-order slice

- Versioned tenant-context and repair-order routes exist under [app/api/v1](app/api/v1).
- Repair-order list, create, read, update, archive, and transition handlers exist.
- Zod validation and route-level authentication, membership, and permission checks are present.
- Pagination exists for repair-order listing.

## 3. Roadmap Status

| Area                                           | Current status                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Project governance and architecture docs       | Present, but partly stale or more optimistic than implementation evidence              |
| Environment and application foundation         | Implemented                                                                            |
| Authentication/session helpers                 | Implemented in code; full runtime coverage is partial                                  |
| Organisation and branch context                | Implemented in code; live coverage is partial                                          |
| RBAC model                                     | Database and query foundation implemented; enforcement incomplete                      |
| RLS                                            | Policies implemented; recorded tenant-isolation tests pass, but coverage is incomplete |
| Repair-order database                          | Partial and internally inconsistent                                                    |
| Repair-order API                               | Routes and unit coverage exist; schema compatibility unresolved                        |
| Repair-order UI                                | Basic list only                                                                        |
| Customers and vehicles                         | Not implemented                                                                        |
| Estimates and supplements                      | Not implemented                                                                        |
| Parts, labour, inspections, invoices, payments | Not implemented                                                                        |
| Offline sync and idempotency                   | Not implemented                                                                        |
| CI/CD and deployment verification              | Not established                                                                        |

## 4. Verification Evidence

Fresh commands run on 2026-09-04:

- `npm run lint` — completed with 0 errors and 1 warning for an unused import in [app/api/v1/repair-orders/route.ts](app/api/v1/repair-orders/route.ts).
- `npm run typecheck` — passed.
- `npm run test` — passed 19 test files and 139 tests.
- `npm run build` — passed; Next.js also reported the deprecated `middleware` convention.
- `git diff --check` — passed for the audit documentation changes.

The saved integration evidence in [rls-test-output.txt](rls-test-output.txt) reports 2 files passed, 7 tests passed, and 1 todo.

## 5. Recommended Order of Work

1. Reconcile the repair-order migration, lifecycle model, transition-history table, RPC, service, and API contracts.
2. Add executable PostgreSQL/Supabase workflow integration tests.
3. Close the RBAC service-boundary and role-mutation authorization gaps.
4. Standardize API error responses and request IDs.
5. Build the repair-order detail and transition UI.
6. Replace dashboard placeholders and resolve or implement settings navigation.
7. Add CI, update stale documentation, remove duplicate Vitest configuration, and plan the middleware migration.
8. Implement customers, vehicles, estimates, parts, labour, inspections, invoices, payments, audit events, offline support, and idempotency as separate vertical slices.

## Final Assessment

WorkShopOS is a partially implemented engineering foundation, not a completed product. Static validation is currently healthy: tests, typecheck, and build pass, with one lint warning. The highest priority is database/workflow contract reconciliation because it controls the correctness of the API, RBAC decisions, transition history, and future frontend work.
