# WorkShopOS Build Status

Date: 2026-09-05
Status: EARLY DEVELOPMENT

## Phase update: repair-order lifecycle remediation

The audit-prioritize-remediate-test-verify loop completed its first targeted
application-layer remediation phase.

- **Audit:** confirmed that the lifecycle migration introduced
  `lifecycle_status` and `primary_repair_stage` while application code still
  read and wrote the legacy `status` field.
- **Prioritize:** selected repair-order contract alignment as remediation item
  #1 because it blocks trustworthy workflow and UI work.
- **Remediate:** aligned repair-order creation, reads, listing, service types,
  and the authenticated list UI with the lifecycle fields; added a regression
  test for lifecycle-based creation.
- **Test / verify:** typecheck, lint, the focused repair-order test suite, and
  the production build all pass.
- **Commit:** pending repository workflow.
- **Next item:** reconcile the PostgreSQL migration chain, transition-history
  columns, and lifecycle RPC signature against the already-aligned app layer.

This phase did not complete database reconciliation. The migration chain still
requires a live PostgreSQL/Supabase verification before the workflow can be
considered end-to-end compatible.

## REM-001 implementation update

The canonical two-field lifecycle reconciliation has been implemented as a
forward migration in
[supabase/migrations/20260905000001_reconcile_repair_order_lifecycle.sql](supabase/migrations/20260905000001_reconcile_repair_order_lifecycle.sql).
It converts legacy transition history, removes both conflicting RPC overloads,
and installs the tenant-checked service-role RPC used by the transition route.

Verification completed:

- focused repair-order tests: 7 files, 58 tests passed;
- full unit suite: 19 files, 140 tests passed;
- integration suite: 2 files, 7 tests passed, 1 todo;
- typecheck, lint, and production build passed;
- local migration/RPC execution was not possible because Docker and Podman are
  unavailable, so PostgreSQL compatibility remains unverified.

REM-001 is implementation-complete but not runtime-verified. REM-002 remains
blocked and has not been started.

## 1. Executive summary

The repository contains a verified engineering foundation, but it does not yet match the full feature scope described in [AGENTS.md](AGENTS.md), [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [API_CONTRACTS.md](API_CONTRACTS.md), [RBAC_PERMISSION_MATRIX.md](RBAC_PERMISSION_MATRIX.md), and [DATABASE.md](DATABASE.md). The codebase currently demonstrates a working foundation for auth, tenant context, RBAC tables, and a limited repair-order API, but it is not yet a complete or production-ready WorkShopOS implementation.

The most important verified facts are:

- [package.json](package.json) defines a Next.js 16 + React 19 + TypeScript project.
- `npm run lint` completed with zero warnings and zero errors after the lifecycle alignment.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.
- `npm run test` passed 19 test files and 139 tests.
- The repository contains migration drift in the repair-order workflow model, including incompatible RPC and transition-history contracts.
- The full domain scope from the product docs is not implemented.

## 2. Repository comparison against the authoritative documents

### Verified against the docs

The repository includes the expected source-of-truth documents:

- [AGENTS.md](AGENTS.md)
- [PRD.md](PRD.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API_CONTRACTS.md](API_CONTRACTS.md)
- [RBAC_PERMISSION_MATRIX.md](RBAC_PERMISSION_MATRIX.md)
- [DATABASE.md](DATABASE.md)

These documents define a broader product and architecture than the code currently implements. The repository is therefore best described as a partial foundation rather than a finished implementation of the target system.

## 3. Area-by-area audit

### Area: Project foundation

1. What was completed
   - Next.js app scaffold is present.
   - TypeScript, Tailwind, and Vitest configuration are present.
   - Environment-aware app configuration exists in [src/lib/auth/config.ts](src/lib/auth/config.ts).

2. Files affected
   - [package.json](package.json)
   - [next.config.ts](next.config.ts)
   - [tsconfig.json](tsconfig.json)
   - [vitest.config.mjs](vitest.config.mjs)
   - [eslint.config.mjs](eslint.config.mjs)
   - [src/lib/auth/config.ts](src/lib/auth/config.ts)

3. Tests/verification performed
   - `npm run lint` — succeeded
   - `npm run typecheck` — succeeded
   - `npm run build` — succeeded

4. Remaining issues
   - README content is still the default Next.js starter content rather than WorkShopOS-specific documentation.
   - No verified production deployment configuration was found.

5. Next recommended task
   - Replace generic project docs and deployment configuration with WorkShopOS-specific operational documentation.

### Area: Tooling and repository configuration

1. What was completed
   - Strict TypeScript configuration, ESLint, Vitest, path aliases, and environment-file ignore rules are present.
   - The default and integration test commands are defined in [package.json](package.json).

2. Files affected
   - [tsconfig.json](tsconfig.json)
   - [eslint.config.mjs](eslint.config.mjs)
   - [vitest.config.mjs](vitest.config.mjs)
   - [vitest.integration.config.mjs](vitest.integration.config.mjs)
   - [.gitignore](.gitignore)
   - [package.json](package.json)

3. Tests/verification performed
   - `npm run lint` completed with zero warnings and zero errors after the lifecycle alignment.
   - `npm run typecheck` succeeded.
   - `npm run test` passed 19 test files and 139 tests.
   - `npm run build` succeeded.

4. Remaining issues
   - [vitest.config.mjs](vitest.config.mjs) contains a duplicated `exclude` property.
   - No `.github` CI workflow was found, despite [ARCHITECTURE.md](ARCHITECTURE.md) identifying GitHub Actions as the CI/CD target.
   - The build reports that the `middleware` file convention is deprecated in favor of `proxy`.

5. Next recommended task
   - Remove the duplicated Vitest configuration, add a minimal CI workflow, and plan the middleware-to-proxy migration.

### Area: Documentation

1. What was completed
   - The required project documents are present in the repo.
   - The docs describe the target architecture, API contracts, RBAC, and database principles.

2. Files affected
   - [AGENTS.md](AGENTS.md)
   - [PRD.md](PRD.md)
   - [ARCHITECTURE.md](ARCHITECTURE.md)
   - [API_CONTRACTS.md](API_CONTRACTS.md)
   - [RBAC_PERMISSION_MATRIX.md](RBAC_PERMISSION_MATRIX.md)
   - [DATABASE.md](DATABASE.md)

3. Tests/verification performed
   - Repository file inspection only.

4. Remaining issues
   - The implementation does not yet match the full roadmap described in the docs.
   - [README.md](README.md) is generic and outdated.
   - [CHANGELOG.md](CHANGELOG.md) is missing.
   - [AGENTS.md](AGENTS.md) still says there is no `npm run test` script, but [package.json](package.json) defines `test`, `test:integration`, `test:watch`, and `test:coverage` scripts.
   - Several roadmap/documentation checklists describe intended or partial work more positively than the current implementation evidence supports.

5. Next recommended task
   - Update the project docs to reflect the current implementation state and call out the remaining gaps explicitly.

### Area: Database foundation

1. What was completed
   - The identity and tenant foundation is implemented in [supabase/migrations/20260830000001_identity_tenant_foundation.sql](supabase/migrations/20260830000001_identity_tenant_foundation.sql).
   - RBAC foundation tables and permissions exist in [supabase/migrations/20260830000002_rbac_foundation.sql](supabase/migrations/20260830000002_rbac_foundation.sql).
   - Minimal repair-order tables, permissions, and transition history exist in the migration chain under [supabase/migrations](supabase/migrations).

2. Files affected
   - [supabase/migrations/20260830000001_identity_tenant_foundation.sql](supabase/migrations/20260830000001_identity_tenant_foundation.sql)
   - [supabase/migrations/20260830000002_rbac_foundation.sql](supabase/migrations/20260830000002_rbac_foundation.sql)
   - [supabase/migrations/20260901000001_repair_orders_read_slice.sql](supabase/migrations/20260901000001_repair_orders_read_slice.sql)
   - [supabase/migrations/20260901000002_repair_order_create_permission.sql](supabase/migrations/20260901000002_repair_order_create_permission.sql)
   - [supabase/migrations/20260901000003_repair_order_update_permission.sql](supabase/migrations/20260901000003_repair_order_update_permission.sql)
   - [supabase/migrations/20260901000004_repair_order_archive.sql](supabase/migrations/20260901000004_repair_order_archive.sql)
   - [supabase/migrations/20260901000005_repair_order_transition_slice.sql](supabase/migrations/20260901000005_repair_order_transition_slice.sql)
   - [supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql](supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql)

3. Tests/verification performed
   - Repo inspection of migration files.
   - The saved integration output records a live Supabase RLS run with 2 test files passed, 7 tests passed, and 1 todo: [rls-test-output.txt](rls-test-output.txt).

4. Remaining issues
   - The application layer now uses the newer lifecycle-stage model, but the migration chain still contains both the older status transition slice and the newer lifecycle migration.
   - The migration history is not yet reconciled to a single final schema.
   - The lifecycle migration's transition-history insert expects columns such as `actor_id`, `action`, and lifecycle/stage fields that are not created by the earlier transition-table migration.
   - The lifecycle migration defines a different `transition_repair_order` signature from the earlier RPC, while the transition route sends eight named parameters that match neither SQL function signature.
   - The list/create/update application routes have been aligned to `lifecycle_status`; the underlying migration compatibility is still unverified.

5. Next recommended task
   - Reconcile the repair-order schema and migration history to one final lifecycle model before continuing with additional workflow work.

### Area: Authentication and tenant context

1. What was completed
   - Session and auth utilities exist in [src/lib/auth/session.ts](src/lib/auth/session.ts), [src/lib/auth/server.ts](src/lib/auth/server.ts), and [src/lib/auth/config.ts](src/lib/auth/config.ts).
   - Login and logout routes exist at [app/api/auth/login/route.ts](app/api/auth/login/route.ts) and [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts).
   - Tenant validation and membership checks exist in [src/server/services/tenant-context.ts](src/server/services/tenant-context.ts) and [src/server/services/active-tenant-context.ts](src/server/services/active-tenant-context.ts).

2. Files affected
   - [src/lib/auth/session.ts](src/lib/auth/session.ts)
   - [src/lib/auth/server.ts](src/lib/auth/server.ts)
   - [src/lib/auth/config.ts](src/lib/auth/config.ts)
   - [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
   - [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts)
   - [src/server/services/tenant-context.ts](src/server/services/tenant-context.ts)
   - [src/server/services/active-tenant-context.ts](src/server/services/active-tenant-context.ts)
   - [app/api/v1/tenant-context/route.ts](app/api/v1/tenant-context/route.ts)
   - [app/api/v1/tenant-context/switch-branch/route.ts](app/api/v1/tenant-context/switch-branch/route.ts)

3. Tests/verification performed
   - Repo inspection only for the implementation.
   - No live Supabase auth verification was run from the repo evidence.

4. Remaining issues
   - The auth flow is present but not fully proven against a real runtime environment.
   - Live RLS tenant-isolation evidence is present in [rls-test-output.txt](rls-test-output.txt), but it does not validate the complete migration chain or all application routes.

5. Next recommended task
   - Run the tenant and auth validation suite against a live local or test Supabase environment and fix any failures before expanding the auth surface.

### Area: RBAC

1. What was completed
   - The RBAC data model exists in the database foundation migration.
   - Permission and role assignment logic exists in [src/server/services/rbac-engine.ts](src/server/services/rbac-engine.ts).

2. Files affected
   - [supabase/migrations/20260830000002_rbac_foundation.sql](supabase/migrations/20260830000002_rbac_foundation.sql)
   - [src/server/services/rbac-engine.ts](src/server/services/rbac-engine.ts)

3. Tests/verification performed
   - Repository inspection.
   - A limited RBAC-related test file exists in [tests/integration/rbac-permissions.test.ts](tests/integration/rbac-permissions.test.ts).

4. Remaining issues
   - Runtime enforcement is incomplete.
   - `canAssignRole()` includes a placeholder comment indicating future enhancement.
   - `getRoleAssignments()`, `getEffectivePermissions()`, and `assertPermission()` pass an always-true membership callback into the tenant boundary, so the service layer does not independently verify that the requested organisation belongs to the authenticated user.
   - `assignRole()` and `removeRole()` use the service-role client and explicitly rely on callers to authorize them; no role-management API or self-contained authorization guard is present.
   - The RBAC implementation is not yet complete enough to be trusted for production enforcement.

5. Next recommended task
   - Finish RBAC enforcement for the real app routes and verify permission checks against a live tenant context before enabling additional protected business features.

### Area: API surface

1. What was completed
   - Auth routes exist.
   - Tenant-context routes exist.
   - Repair-order CRUD and transition routes exist.

2. Files affected
   - [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
   - [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts)
   - [app/api/v1/auth-protected/route.ts](app/api/v1/auth-protected/route.ts)
   - [app/api/v1/tenant-context/route.ts](app/api/v1/tenant-context/route.ts)
   - [app/api/v1/tenant-context/current-organisation/route.ts](app/api/v1/tenant-context/current-organisation/route.ts)
   - [app/api/v1/tenant-context/current-branch/route.ts](app/api/v1/tenant-context/current-branch/route.ts)
   - [app/api/v1/tenant-context/switch-branch/route.ts](app/api/v1/tenant-context/switch-branch/route.ts)
   - [app/api/v1/repair-orders/route.ts](app/api/v1/repair-orders/route.ts)
   - [app/api/v1/repair-orders/[id]/route.ts](app/api/v1/repair-orders/[id]/route.ts)
   - [app/api/v1/repair-orders/[id]/transition/route.ts](app/api/v1/repair-orders/[id]/transition/route.ts)

3. Tests/verification performed
   - `npm run build` succeeded.
   - `npm run typecheck` succeeded.
   - `npm run lint` succeeded.
   - The repository contains dedicated route tests, but not all are green in the current run.

4. Remaining issues
   - The API does not yet cover the broader WorkShopOS modules described in the docs.
   - The transition API uses the lifecycle action contract, but its database RPC remains unverified against the complete migration chain.
   - The route's RPC parameter object is incompatible with both migration-defined function signatures.
   - The non-transition repair-order routes now use lifecycle fields; database migration compatibility remains unresolved.
   - Auth and tenant routes return ad-hoc string errors rather than the documented structured error contract with an error code and request ID.

5. Next recommended task
   - Finalize the repair-order transition schema and then extend the same API pattern to the next domain slices only after the foundation is fully validated.

### Area: Frontend

1. What was completed
   - The app shell and authenticated layout exist.
   - A dashboard page and a basic repair-order list page exist.
   - Login page exists.

2. Files affected
   - [app/layout.tsx](app/layout.tsx)
   - [app/login/page.tsx](app/login/page.tsx)
   - [app/(authenticated)/layout.tsx](<app/(authenticated)/layout.tsx>)
   - [app/(authenticated)/page.tsx](<app/(authenticated)/page.tsx>)
   - [app/(authenticated)/repair-orders/page.tsx](<app/(authenticated)/repair-orders/page.tsx>)
   - [src/components/layout/app-shell.tsx](src/components/layout/app-shell.tsx)

3. Tests/verification performed
   - The authenticated repair-order list was updated to render `lifecycle_status`.
   - The production build passed after the lifecycle field alignment.

4. Remaining issues
   - There is no functional workflow detail UI.
   - No customer, vehicle, estimate, or invoice UI exists yet.
   - The current repair-order UI is limited to a list page.
   - The dashboard displays static placeholder values such as `Online`, `Active`, and `Review queue` rather than data-backed operational metrics.
   - The `Workshop settings` navigation item points to `/settings`, but no matching app route was found.
   - No frontend loading, error, pagination controls, create form, detail screen, or transition controls were found for the repair-order workflow.

5. Next recommended task
   - Build the repair-order detail view with workflow controls and then extend to the next business screens only after the data model is stable.

### Area: Repair-order workflow

1. What was completed
   - A transition endpoint exists.
   - A lifecycle-stage migration model exists.
   - A minimal transition-history table exists.

2. Files affected
   - [app/api/v1/repair-orders/[id]/transition/route.ts](app/api/v1/repair-orders/[id]/transition/route.ts)
   - [supabase/migrations/20260901000005_repair_order_transition_slice.sql](supabase/migrations/20260901000005_repair_order_transition_slice.sql)
   - [supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql](supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql)

3. Tests/verification performed
   - Repository inspection of the transition route and migration files.
   - The saved RLS integration output reports 7 passing tests and 1 todo.
   - The focused transition suite passed 14 tests after the application-layer alignment.

4. Remaining issues
   - There are two different repair-order workflow models in the migration history.
   - The transition-history table shape, lifecycle RPC shape, and route call shape are not aligned.
   - The transition route and application reads are aligned to the lifecycle model, but the migration/RPC contract is not yet aligned to one final verified version.
   - No verified full workflow e2e flow exists.
   - The route unit tests mock the Supabase RPC and therefore do not prove that the SQL state machine or transition-history write succeeds.

5. Next recommended task
   - Choose one canonical lifecycle state model and align the migration, route logic, and tests before implementing the next workflow stage.

### Area: Testing and quality checks

1. What was completed
   - Unit tests exist for auth, app shell, tenant, RBAC, and repair-order flows.
   - Integration test scaffolding exists.
   - Typecheck, lint, and production build succeed in this environment.

2. Files affected
   - [tests/unit](tests/unit)
   - [tests/integration](tests/integration)
   - [vitest.config.mjs](vitest.config.mjs)
   - [vitest.integration.config.mjs](vitest.integration.config.mjs)

3. Tests/verification performed
   - `npm run lint` — passed with zero errors and zero warnings.
   - `npm run typecheck` — succeeded
   - `npm run build` — succeeded
   - `npx vitest run tests/unit/repair-order-transition.test.ts` — passed 1 file and 14 tests

4. Remaining issues
   - The full test suite has not been re-run as part of this phase's final verification.
   - There is no verified e2e coverage for workflow progression.
   - [tests/unit/repair-order-transition-migration.test.ts](tests/unit/repair-order-transition-migration.test.ts) checks migration text rather than executing the migration against PostgreSQL.

5. Next recommended task
   - Reconcile and execute the repair-order migration/RPC contract against PostgreSQL, then add integration coverage for the lifecycle workflow.

## 4. Status against the project roadmap

### What is clearly verified as completed

- Next.js app foundation is in place.
- Auth/session helpers exist.
- Tenant context and membership validation exist.
- RBAC tables exist.
- Repair-order CRUD and transition routes exist.
- Basic app shell and dashboard are present.
- Repair-order application reads and writes use the lifecycle model.
- The focused repair-order regression suite passes.
- Typecheck, lint, and build pass with no reported lint warnings.

### What remains unverified or incomplete

- Full RBAC enforcement and complete application-level tenant validation against a live Supabase instance.
- Final repair-order workflow schema and migration reconciliation.
- Full WorkShopOS domain modules beyond repair orders.
- Production deployment and CI configuration.
- End-to-end workflow validation.

## 5. Current maturity classification

Status: EARLY DEVELOPMENT

This repo has a credible foundation, but it does not yet satisfy the full product scope described in the authoritative docs. The codebase currently demonstrates a secure-enough starting point for auth and tenant foundations, but the project still requires a significant amount of functional and verification work before it can be considered a usable WorkShopOS application.

## 6. Verification evidence

The status above is based only on repository evidence and these verified commands:

- `npm run lint` — passed with zero errors and zero warnings
- `npm run typecheck` — succeeded
- `npm run build` — succeeded
- `npx vitest run tests/unit/repair-order-transition.test.ts` — passed 1 file and 14 tests

Key files reviewed:

- [AGENTS.md](AGENTS.md)
- [PRD.md](PRD.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API_CONTRACTS.md](API_CONTRACTS.md)
- [RBAC_PERMISSION_MATRIX.md](RBAC_PERMISSION_MATRIX.md)
- [DATABASE.md](DATABASE.md)
- [package.json](package.json)
- [src/server/services/tenant-context.ts](src/server/services/tenant-context.ts)
- [src/server/services/rbac-engine.ts](src/server/services/rbac-engine.ts)
- [app/api/v1/repair-orders/[id]/transition/route.ts](app/api/v1/repair-orders/[id]/transition/route.ts)
- [supabase/migrations/20260830000001_identity_tenant_foundation.sql](supabase/migrations/20260830000001_identity_tenant_foundation.sql)
- [supabase/migrations/20260830000002_rbac_foundation.sql](supabase/migrations/20260830000002_rbac_foundation.sql)
- [supabase/migrations/20260901000005_repair_order_transition_slice.sql](supabase/migrations/20260901000005_repair_order_transition_slice.sql)
- [supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql](supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql)
- [tests/unit/auth-infrastructure.test.ts](tests/unit/auth-infrastructure.test.ts)

This document intentionally records only work that is completed and verifiable from the repository at the current date. Update this phase log after each major audit, remediation, test, verification, and commit phase before starting the next remediation item.

- [supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql](supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql)
- [src/server/services/rbac-engine.ts](src/server/services/rbac-engine.ts)
- [src/server/services/tenant-context.ts](src/server/services/tenant-context.ts)
- [app/api/v1/repair-orders/[id]/transition/route.ts](app/api/v1/repair-orders/[id]/transition/route.ts)
- [tests/unit/auth-infrastructure.test.ts](tests/unit/auth-infrastructure.test.ts)

This document is intended to be updated whenever significant WorkShopOS development is completed, using verified repo evidence only.

## 7. Session verification update — 2026-09-16

### REM-001 cloud verification

REM-001 cloud verification is **closed** as of 2026-09-16. Migration
`20260905000001_reconcile_repair_order_lifecycle.sql` was pushed with
`supabase db push`. The canonical seven-parameter `transition_repair_order`
RPC is live, both stale five-parameter overloads were dropped, and the
previous `PGRST202` error is eliminated.

### Repository recovery

Repository recovery restored 9 migrations, 24 tests, and 16 documentation
files from `HEAD` after worktree deletion. The junk `index.html` containing a
saved GitHub page was removed.

### Unit verification

The unit suite is now **140/140**, up from 65/140 immediately after restore.
The verified repairs included structured error bodies, tenant-denial status
changes from 400 to 403, `getUser` authentication mocks, and lifecycle test
fixtures. Two real route bugs were found and fixed: malformed organisation ID
requests now return `400 VALIDATION_ERROR` as required by API Contracts §7,
instead of `403`.

### Live integration verification

Against the live cloud project, the integration suite recorded **7 passed and
1 todo**, proving RLS isolation and RBAC behavior. `.env.test` was created and
is gitignored.

### Environment verification

`SUPABASE_SERVICE_ROLE_KEY` was added to `.env.local`; `src/lib/auth/config.ts`
reads the non-public variable name. The new-format `sb_publishable` and
`sb_secret` keys are working.

### Known gaps

The following gaps are recorded and intentionally not fixed in this update:

- No lifecycle-transition integration test exists. The REM-002 claim does not
  match repository reality; this is deferred and should be covered through the
  demo smoke flow.
- The cross-branch integration test remains a `.todo` placeholder.
- The unused `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` remains in `.env.local`;
  remove it after the demo.
- A CLI access token and database password were exposed in chat; rotate them
  if that has not already been done.
