# WorkShopOS Technical Debt

This document records only issues that are directly evidenced by the repository and verification output. It is intentionally scoped to debt that remains before the platform can be considered complete.

## 1. Repair-order workflow drift

### Status

- Verified issue

### Evidence

- The migration history contains both the older status transition slice and the newer lifecycle-stage model:
  - [supabase/migrations/20260901000005_repair_order_transition_slice.sql](supabase/migrations/20260901000005_repair_order_transition_slice.sql)
  - [supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql](supabase/migrations/20260903000001_repair_order_lifecycle_stage_model.sql)

### Impact

- The workflow model is not yet a single canonical source of truth.
- Future implementation work risks diverging business rules and inconsistent state transitions.

### Recommended action

- Reconcile the repair-order status model into one final lifecycle before shipping additional workflow logic.

### Additional contract mismatches

- The lifecycle migration's history insert references columns that are absent from the transition table created by the earlier migration.
- The lifecycle RPC signature does not match the earlier RPC or the parameters sent by [app/api/v1/repair-orders/[id]/transition/route.ts](app/api/v1/repair-orders/[id]/transition/route.ts).
- The other repair-order routes still use the legacy `status` column after the lifecycle migration renames it to `legacy_status`.

## 2. RBAC enforcement remains incomplete

### Status

- Verified issue

### Evidence

- RBAC tables exist in [supabase/migrations/20260830000002_rbac_foundation.sql](supabase/migrations/20260830000002_rbac_foundation.sql).
- A permission engine exists in [src/server/services/rbac-engine.ts](src/server/services/rbac-engine.ts).
- The implementation still includes placeholder or incomplete authorization logic.

### Impact

- Protected business actions cannot yet be treated as fully trusted without a live verification pass.

### Recommended action

- Complete the RBAC enforcement path across all protected routes and validate against a live tenant context.

### Service-layer authorization gaps

- `getRoleAssignments()`, `getEffectivePermissions()`, and `assertPermission()` override the tenant membership callback with `async () => true`.
- `assignRole()` and `removeRole()` perform privileged writes without checking the actor, target membership, role scope, or permission containment.

These helpers are currently safe only when every caller performs the missing checks correctly. The service layer should enforce the boundary itself before role or permission data is read or mutated.

## 3. Live RLS validation is partial

### Status

- Verified issue

### Evidence

- [rls-test-output.txt](rls-test-output.txt) records a live integration run with 2 test files passed, 7 tests passed, and 1 todo.
- The repository contains RLS test scaffolding under [tests/integration](tests/integration), but the recorded run does not validate every migration/API contract and leaves cross-branch coverage as a todo.

### Impact

- The recorded cross-tenant repair-order checks passed, but complete cross-branch and post-reconciliation validation is not yet confirmed.

### Recommended action

- Re-run the security validation suite after reconciling the migration chain, then complete the outstanding cross-branch coverage.

## 4. Verification warnings and coverage gaps

### Status

- Verified issue

### Evidence

- The current `npm run test` run passed 19 test files and 139 tests.
- `npm run lint` completed with zero errors but reports one unused import in [app/api/v1/repair-orders/route.ts](app/api/v1/repair-orders/route.ts).
- `npm run build` completed successfully but reports that the `middleware` file convention is deprecated in favor of `proxy`.

### Impact

- The default test suite is currently green, but lint is not warning-free and the build uses a deprecated framework convention.
- Passing unit tests do not prove the unresolved migration/API compatibility issues or full workflow behavior.

### Recommended action

- Remove the unused import, plan the middleware-to-proxy migration, and add focused integration checks around workflow and security boundaries.

## 5. API error contract drift

### Status

- Verified issue

### Evidence

- [API_CONTRACTS.md](API_CONTRACTS.md) requires structured errors with `code`, `message`, `request_id`, and optional `details`.
- The auth, tenant-context, and repair-order routes return plain strings such as `{ error: "Forbidden" }` or `{ error: message }`.

### Impact

- Clients cannot rely on one stable error shape or machine-readable error code.
- Internal validation and membership messages may be exposed directly to API callers.

### Recommended action

- Introduce the shared API error response helper and map authentication, authorization, validation, not-found, conflict, and internal failures to the documented contract.

## 6. Documentation and tooling drift

### Status

- Verified issue

### Evidence

- [AGENTS.md](AGENTS.md) says no `npm run test` script exists, while [package.json](package.json) defines the default and integration test scripts.
- [README.md](README.md) remains the create-next-app starter guide.
- [vitest.config.mjs](vitest.config.mjs) declares the `exclude` property twice.
- No `.github` directory or GitHub Actions workflow was found, while [ARCHITECTURE.md](ARCHITECTURE.md) lists GitHub Actions as the CI/CD target.
- `npm run build` reports that the `middleware` convention is deprecated in favor of `proxy`.

### Impact

- Maintainers may follow stale test instructions.
- Repository configuration contains avoidable duplication.
- CI and deployment verification are not represented in the repository.
- A future framework upgrade may require a middleware convention migration.

### Recommended action

- Update the stale documentation, remove the duplicate Vitest property, add a minimal CI workflow, and schedule the middleware-to-proxy migration.

## 5. Documentation is not fully aligned with code

### Status

- Verified issue

### Evidence

- Project docs describe a broad product roadmap, while the codebase still reflects an early-stage foundation.
- [README.md](README.md) remains generic rather than WorkShopOS-specific.

### Impact

- The repository can be read as a set of planned features rather than a fully accurate current-state record without careful auditing.

### Recommended action

- Update project documentation to explicitly distinguish the implemented baseline from the target roadmap.

## 6. Broad product scope is still incomplete

### Status

- Verified issue

### Evidence

- The app includes a basic login flow and repair-order surface, but the broader domain footprint described by the product docs is not implemented in the repo.

### Impact

- The platform remains early-stage and not yet production-usable.

### Recommended action

- Continue by stabilizing the shared foundation and then implement the next vertical slice only after the current data model is reconciled.

## 7. Frontend is still a shell

### Status

- Verified issue

### Evidence

- [app/(authenticated)/page.tsx](<app/(authenticated)/page.tsx>) renders static dashboard values rather than queried workshop data.
- [app/(authenticated)/repair-orders/page.tsx](<app/(authenticated)/repair-orders/page.tsx>) renders a read-only table and has no detail, create, update, or transition controls.
- [src/components/layout/app-shell.tsx](src/components/layout/app-shell.tsx) links to `/settings`, but no matching app route exists.

### Impact

- The current UI cannot support the core repair-order workflow described by the product requirements.
- Users can be directed to a dead navigation route.

### Recommended action

- Build the repair-order detail and transition workflow, add loading/error states, and either implement or remove the settings route.

## 8. Workflow test coverage does not execute the state machine

### Status

- Verified issue

### Evidence

- [tests/unit/repair-order-transition.test.ts](tests/unit/repair-order-transition.test.ts) explicitly mocks the Supabase RPC.
- [tests/unit/repair-order-transition-migration.test.ts](tests/unit/repair-order-transition-migration.test.ts) asserts SQL text rather than executing the migration.

### Impact

- Invalid transition ordering, database function signatures, transition-history writes, and concurrent row locking are not proven by the unit suite.

### Recommended action

- Add a real PostgreSQL/Supabase integration suite for the canonical lifecycle migration and execute the transition RPC through the API boundary.

## 7. Generic starter metadata remains

### Status

- Potential issue with direct evidence in the repo

### Evidence

- [app/layout.tsx](app/layout.tsx) still contains default app metadata rather than WorkShopOS-specific product metadata.

### Impact

- The product identity remains partially unbound to the WorkShopOS brand.

### Recommended action

- Replace the remaining generic metadata with project-specific branding and operational information.
