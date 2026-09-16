## WorkShopOS — Budget-Constrained MVP Completion Directive

Act as a senior full-stack engineer responsible for bringing the existing **WorkShopOS** project to a stable, demonstrable MVP.

### 1. Budget and billing constraint

The original objective is to build a **functional MVP for presentation and demonstration purposes**, not a production-scale commercial deployment.

I currently have limited/no budget for infrastructure and need to complete the project within available **free-tier quotas and services**.

Therefore:

* Prioritize **free-tier tools and services** wherever technically practical.
* Do not introduce paid services, subscriptions, premium APIs, or unnecessary infrastructure.
* Do not recommend upgrading a service unless it is genuinely required for a demonstrated technical limitation.
* Avoid unnecessary consumption of AI/API quotas.
* Reuse existing project infrastructure, dependencies, documentation, migrations, tests, and implementation work wherever possible.
* Prefer simple, maintainable solutions over premature production-grade complexity.
* Do not rebuild functionality that already exists and has been verified.
* Treat the MVP presentation requirement as the current scope boundary.

The objective is to **finish a credible, functional MVP using the resources already available before my development/AI quota is exhausted**.

### 2. Existing project context

WorkShopOS is a vehicle collision-repair/body-shop management application.

The intended stack is:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* Supabase
* React Query
* Zod
* Git/GitHub
* Free-tier development and hosting services where applicable

The application is being developed on Linux Mint without Docker or WSL.

The project already contains substantial architecture, governance, database, RBAC, API-contract, and implementation work.

Relevant authoritative documentation includes:

* `AGENTS.md`
* `PRD.md`
* `ARCHITECTURE.md`
* `API_CONTRACTS.md`
* `RBAC_PERMISSION_MATRIX.md`
* `DATABASE.md`
* `CLAUDE.md`
* `REMEDIATION_PLAN.md`
* relevant architectural decision records
* migration files
* `BUILD_STATUS.md`

These documents must be treated as the source of truth before making architectural or implementation decisions.

### 3. Current repair-order remediation state

The repair-order lifecycle remediation has already progressed significantly.

The approved model uses:

* `lifecycle_status`
* `primary_repair_stage`

The obsolete `legacy_status` field has been addressed by the reconciliation migration.

REM-001 has been implemented and associated tests have been added.

REM-002 has added genuine Supabase integration coverage for:

* repair-order creation/read
* lifecycle transitions
* resulting lifecycle fields
* transition history
* tenant isolation
* authenticated-client RPC denial
* tenant-scope rejection

Current verification has demonstrated substantial success, including:

* application tests passing
* integration tests largely passing
* type checking passing
* lint passing
* build passing

However, an important integration limitation was identified:

> The configured Supabase project does not yet contain the canonical REM-001 transition RPC. The test environment still exposes the older five-parameter RPC, causing canonical transition calls to fail with `PGRST202`.

Do **not** treat this as resolved merely because the application code or migration file exists.

### 4. Engineering rule: inspect before changing

Before implementing any additional remediation or feature:

1. Inspect the current repository state.
2. Inspect the relevant source files.
3. Inspect the applicable migration history.
4. Inspect the existing tests.
5. Inspect `BUILD_STATUS.md`.
6. Inspect `REMEDIATION_PLAN.md`.
7. Compare the documented architecture against the actual implementation.
8. Run the smallest relevant verification commands.
9. Determine whether the reported problem still exists.
10. Only then make changes.

Do not assume that a previous audit finding remains valid.

Do not assume that a migration has actually been applied merely because the migration file exists.

Do not assume that a test passing means the underlying integration is correct.

Do not report something as fixed unless the result has been verified.

### 5. Verification standard

After every meaningful implementation change, verify the result using the smallest appropriate test set first.

Then progressively run:

1. focused tests
2. related integration tests
3. full test suite
4. typecheck
5. lint
6. production build
7. `git diff --check`
8. final repository/status inspection

For database-related changes, distinguish clearly between:

* migration exists locally
* migration was applied
* database schema is correct
* RPC exists
* RLS works
* authenticated access works
* tenant isolation works
* integration tests pass against the actual configured Supabase environment

Never conflate these states.

### 6. MVP scope

The immediate goal is **not** to implement every possible WorkShopOS feature.

Prioritize the smallest coherent vertical slice capable of demonstrating the product professionally.

The MVP should demonstrate the core workflow of a collision-repair shop:

**Customer → Vehicle → Repair Order → Repair Lifecycle → Repair Stage → Progress → Inspection/Completion**

The primary repair workflow consists of:

1. Disassembly
2. Parts Ordering
3. Panel Beating
4. Paint Preparation
5. Painting
6. Assembly
7. Outwork/Polishing
8. Final Inspection

The system should demonstrate that a repair order can move through this workflow while respecting authentication, organisation/tenant boundaries, permissions, and lifecycle rules.

### 7. Implementation priorities

Work in this order unless repository evidence shows a better dependency order:

#### Phase 1 — Establish the real baseline

* Inspect repository status.
* Read the authoritative documentation.
* Inspect `REMEDIATION_PLAN.md`.
* Inspect `BUILD_STATUS.md`.
* Inspect outstanding remediation items.
* Identify incomplete or contradictory implementation.
* Run baseline verification.

**Deliverable:** confirmed current project state.

#### Phase 2 — Finish database/schema integrity

Resolve remaining database discrepancies before building additional UI.

Verify:

* repair-order schema
* lifecycle fields
* repair stages
* transition history
* tenant relationships
* organisation/branch relationships
* required constraints
* indexes
* RLS
* RPC security
* migration ordering

Apply required migrations only where appropriate and safe.

For the current Supabase limitation, determine the correct low-cost solution for ensuring the canonical transition RPC is actually available in the development/test database.

**Deliverable:** database contract and actual Supabase schema agree.

#### Phase 3 — Finish remediation items

Work through `REMEDIATION_PLAN.md` sequentially.

For every remediation:

* inspect
* implement
* test
* verify
* document
* update `BUILD_STATUS.md`

Do not start unrelated feature work while a blocking architectural/data-integrity remediation remains unresolved.

**Deliverable:** remediation plan completed or every remaining item explicitly classified as MVP-deferred with justification.

#### Phase 4 — Complete the core application

Implement only the functionality required for the demonstrable MVP.

Priority:

* authentication
* organisation/tenant context
* dashboard
* customer management
* vehicle management
* repair-order creation
* repair-order list
* repair-order detail
* lifecycle status
* primary repair stage
* stage transitions
* transition history
* basic progress visibility
* final inspection/completion

Avoid unnecessary features such as advanced accounting, complex notifications, sophisticated analytics, external integrations, or enterprise billing unless already implemented and required for the demonstration.

**Deliverable:** complete core business workflow.

#### Phase 5 — RBAC and security verification

Verify the already-defined RBAC architecture against the actual implementation.

At minimum demonstrate:

* authenticated users cannot access another organisation's data
* organisation membership is enforced
* branch restrictions work where applicable
* protected operations require the appropriate permission
* lifecycle transitions cannot bypass business rules
* service-role operations are not exposed insecurely to clients
* unauthorized RPC access is denied

**Deliverable:** credible multi-tenant security boundary for the MVP.

#### Phase 6 — Presentation UI

Once the backend workflow is stable, finish the presentation layer.

Prioritize:

* responsive dashboard
* clean navigation
* repair-order workflow
* clear lifecycle/stage indicators
* usable forms
* loading states
* empty states
* error states
* mobile responsiveness
* professional visual hierarchy

Do not spend quota on cosmetic perfection before the core workflow is functional.

**Deliverable:** presentation-ready MVP.

#### Phase 7 — End-to-end verification

Perform a complete demonstration workflow using realistic test data:

1. Sign in.
2. Select/access an organisation.
3. Create a customer.
4. Create a vehicle.
5. Create a repair order.
6. Open the repair order.
7. Transition through repair stages.
8. Verify lifecycle status changes.
9. Verify transition history.
10. Confirm tenant isolation.
11. Complete/final-inspect the repair order.
12. Verify the resulting state after refresh.

Record any remaining defects.

**Deliverable:** reproducible end-to-end demonstration.

#### Phase 8 — Final stabilization

Run:

```text
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
git diff --check
```

Inspect the results rather than relying solely on exit codes.

Resolve genuine failures.

Do not introduce unnecessary refactoring immediately before presentation.

**Deliverable:** clean, reproducible MVP build.

### 8. Quota-efficiency rules

Because AI/development quota is limited:

* Batch related inspections together.
* Avoid repeating information already established.
* Do not regenerate entire files when a targeted change is sufficient.
* Prefer complete drop-in changes when modifications are required.
* Use existing tests as evidence before writing new tests.
* Reuse existing components and utilities.
* Avoid unnecessary dependencies.
* Avoid speculative architecture.
* Avoid paid infrastructure.
* Do not perform cosmetic refactoring unless it directly improves the MVP.
* Resolve root causes rather than repeatedly patching symptoms.

### 9. Decision rule

When deciding between two technically valid approaches, prefer the option that:

1. costs $0 within available free tiers,
2. requires fewer dependencies,
3. consumes less AI/development quota,
4. minimizes implementation complexity,
5. preserves the existing architecture,
6. is easier to demonstrate,
7. can be verified locally or against the existing Supabase environment.

### 10. Definition of Done

WorkShopOS should be considered MVP-complete when:

* the application builds successfully
* the core collision-repair workflow is functional
* authentication works
* tenant boundaries are enforced
* RBAC protections are credible and tested
* repair orders can be created and viewed
* lifecycle status works
* primary repair stage works
* stage transitions work
* transition history works
* the database and application contracts agree
* critical integration tests pass against the actual configured environment
* the UI is responsive and presentation-ready
* no known critical defects remain
* the project can be demonstrated from login through completed repair order
* all remaining non-MVP work is explicitly documented

### 11. Most important instruction

**Inspect the actual results before producing conclusions or recommending the next step.**

Do not tell me that something is fixed simply because code was changed.

Do not tell me that a migration is applied because the migration file exists.

Do not tell me that tests pass without inspecting the test output.

Do not proceed based on assumptions when repository evidence is available.

For every stage, report:

**Observed → Verified → Changed → Tested → Result → Next action**

The objective is to finish a **credible, functional WorkShopOS MVP using free-tier resources**, while preserving the architectural work already completed and avoiding unnecessary expenditure or quota consumption.

