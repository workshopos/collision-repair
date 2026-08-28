For WorkShopOS, I would use a controlled vertical-slice roadmap rather than a single mega-prompt. Each stage has a narrow objective, explicit boundaries, tests, and a stop condition.

The AI should never be allowed to decide the entire architecture while coding. AGENTS.md, PRD.md, ARCHITECTURE.md, API_CONTRACTS.md, and RBAC_PERMISSION_MATRIX.md remain the source of truth.

WorkShopOS — 40-Stage AI Vibe-Coding Roadmap
How to use this roadmap

For every stage:

Start from a clean Git state.
Give the AI only the prompt for that stage.
Let it inspect the existing code first.
Require it to make only the requested changes.
Run tests/typecheck/lint/build.
Review the diff.
Manually test the feature.
Commit the result.
Only then move to the next stage.

Recommended cycle:

AI Prompt
   ↓
Inspect
   ↓
Plan
   ↓
Implement
   ↓
Test
   ↓
Lint
   ↓
Typecheck
   ↓
Build
   ↓
Human review
   ↓
Git commit
PHASE 0 — GOVERNANCE & FOUNDATION
Stage 1 — Repository audit
Goal

Make the AI understand the repository without changing it.

Copy/paste prompt
You are working on WorkShopOS, a vehicle autobody collision repair management system.

Read these documents first:

- AGENTS.md
- PRD.md
- ARCHITECTURE.md
- API_CONTRACTS.md
- RBAC_PERMISSION_MATRIX.md

Do NOT modify any files.

Inspect the entire repository.

Report:

1. Current directory structure
2. Framework and versions
3. Installed dependencies
4. Existing application routes
5. Existing components
6. Database integration
7. Authentication implementation
8. RBAC implementation
9. API implementation
10. Testing setup
11. Security concerns
12. Architectural inconsistencies
13. Missing infrastructure
14. Technical debt

Do not write code.

Do not recommend replacing the architecture unless there is a demonstrable problem.

End with a proposed implementation sequence for the next stage.
Acceptance

AI changes zero files.

Stage 2 — Establish engineering guardrails
Goal

Make the repository safe for AI-assisted development.

Read AGENTS.md, PRD.md and ARCHITECTURE.md.

Implement only the engineering guardrails required for WorkShopOS.

Configure:

- TypeScript strict mode
- ESLint
- Prettier
- npm scripts for lint
- npm script for typecheck
- npm script for build
- test command if testing is already configured
- consistent import aliases
- basic error handling conventions

Do not implement business functionality.

Do not change the application architecture.

Do not add unnecessary dependencies.

Run:

npm run lint
npm run typecheck
npm run build

Fix only issues caused by this stage.

Report exactly what changed.
Stage 3 — Environment configuration
Implement WorkShopOS environment configuration.

Requirements:

- Supabase URL
- Supabase public/anon key
- server-only environment variables where required
- .env.example
- safe environment validation
- never expose server secrets to client components
- never hard-code credentials

Create a typed environment configuration layer.

Do not implement authentication yet.

Do not modify database schemas.

Run lint, typecheck and build.

Verify that .env.local is ignored by Git.
Stage 4 — Supabase foundation
Implement the WorkShopOS Supabase foundation.

Create:

- browser Supabase client
- server Supabase client
- server-side authentication helper structure
- database type placeholder/generated type location
- storage abstraction location

Follow ARCHITECTURE.md.

Do not implement business modules.

Do not bypass RLS.

Do not introduce service-role credentials into client code.

Run lint, typecheck and build.
PHASE 1 — SECURITY & IDENTITY
Stage 5 — Database identity model

Create the initial database foundation.

Implement only the WorkShopOS identity database foundation.

Create migrations for:

- organisations
- branches
- profiles
- organisation_memberships

Requirements:

- UUID primary keys
- created_at
- updated_at where appropriate
- foreign keys
- appropriate indexes
- constraints
- timestamps
- soft-delete strategy where required by architecture

Do not create customers, vehicles, repair orders or financial tables.

Do not create application UI.

Do not use destructive migrations.

Add appropriate RLS policies.

Document the migration.

Run database validation where available.
Stage 6 — Authentication
Implement WorkShopOS authentication.

Scope:

- login
- logout
- session detection
- protected routes
- unauthenticated redirect
- authenticated redirect
- auth error handling

Use Supabase Auth.

Do not implement roles yet.

Do not implement customer/vehicle functionality.

Do not expose sensitive session data to the client.

Add tests for:

- unauthenticated access
- authenticated access
- logout
- invalid login

Run lint, typecheck, tests and build.
Stage 7 — Organisation and branch context
Implement organisation and branch context.

A user must be able to belong to an organisation and one or more branches according to the architecture.

Implement:

- current organisation
- current branch
- branch switching where permitted
- secure server-side context resolution

Do not implement RBAC permissions yet.

Do not trust organisation_id or branch_id supplied by the browser.

All tenant boundaries must ultimately be enforced through RLS.

Add tests for cross-organisation isolation.

Run lint, typecheck, tests and build.
Stage 8 — RBAC engine
Implement the WorkShopOS RBAC engine according to RBAC_PERMISSION_MATRIX.md.

Implement:

- roles
- permissions
- role-permission mapping
- user membership roles
- permission checking
- server-side authorization helper
- client-side permission helper for UI visibility only

Important:

Client-side permission checks must NEVER be treated as security boundaries.

Server authorization and database RLS remain authoritative.

Do not invent new permissions.

Use the exact permission identifiers defined in RBAC_PERMISSION_MATRIX.md.

Add unit tests for permission evaluation.
Stage 9 — RLS security verification
Perform a security-focused review of all WorkShopOS identity and RBAC tables.

Do not add unrelated functionality.

Verify:

- users cannot access another organisation
- users cannot access another branch unless authorized
- role assignments are protected
- permissions cannot be escalated through client requests
- deleted/inactive memberships cannot authenticate into protected operations
- service-role usage is server-only

Create automated database/RLS tests where practical.

Report every security assumption.

Do not claim security is complete unless it is demonstrably enforced.
Stage 10 — Application shell
Implement the WorkShopOS authenticated application shell.

Create:

- desktop sidebar
- mobile navigation
- top navigation
- user menu
- organisation/branch context
- responsive layout
- loading state
- error state
- not-found state

Use the existing design system.

Do not implement business modules.

Navigation items must respect RBAC visibility.

The UI must work from approximately 360px mobile width through desktop.

Run lint, typecheck and build.
PHASE 2 — CORE CUSTOMER & VEHICLE DATA
Stage 11 — Customer database
Implement the customer domain database layer only.

Create the necessary customer tables, relationships, indexes and constraints according to PRD.md and ARCHITECTURE.md.

Support:

- individual customers
- business customers where specified
- contact information
- addresses where required
- status
- audit timestamps

Implement RLS.

Do not build the customer UI yet.

Do not implement repair orders.

Add database tests.
Stage 12 — Customer service layer
Implement the Customer service layer.

Create:

- customer repository
- customer service
- validation schemas
- typed domain models
- standardized errors

Operations:

- create
- read
- update
- search
- archive where permitted

Enforce RBAC through the server layer.

Do not build UI.

Do not directly expose unrestricted database operations.

Add unit tests.
Stage 13 — Customer API
Implement the Customer API according to API_CONTRACTS.md.

Implement only:

GET customers
GET customer
POST customer
PATCH customer
POST customer archive if specified

Requirements:

- authentication
- RBAC
- Zod validation
- consistent response format
- consistent errors
- pagination
- search
- safe filtering
- tenant isolation

Do not implement vehicles.

Add API integration tests.
Stage 14 — Customer UI
Implement the WorkShopOS Customer UI.

Create:

- customer list
- search
- pagination
- customer creation
- customer details
- customer editing
- archive confirmation

Requirements:

- mobile responsive
- accessible forms
- loading states
- empty states
- validation errors
- server errors
- permission-aware actions

Use the existing API/service architecture.

Do not access Supabase directly from presentation components.
Stage 15 — Vehicle database
Implement the Vehicle domain database layer.

Support the required collision-repair vehicle information, including where appropriate:

- VIN
- registration number
- make
- model
- year
- colour
- mileage
- vehicle identification details
- customer relationship

Add:

- constraints
- indexes
- timestamps
- RLS
- audit considerations

Do not implement repair orders.

Do not create UI.

Add database tests.
Stage 16 — Vehicle service/API
Implement the Vehicle service and API.

Operations:

- create vehicle
- view vehicle
- update vehicle
- search vehicles
- customer vehicle listing

Requirements:

- authentication
- RBAC
- tenant isolation
- Zod validation
- pagination
- safe search
- standardized errors

Do not implement repair orders.

Add integration tests.
Stage 17 — Vehicle UI
Implement the Vehicle UI.

Create:

- vehicle list
- vehicle search
- add vehicle
- vehicle details
- edit vehicle
- customer vehicle list

Allow navigation:

Customer
→ Vehicles
→ Vehicle Details

Do not implement repair orders yet.

Follow the existing responsive design system.

Test mobile and desktop layouts.
PHASE 3 — COLLISION REPAIR CORE
Stage 18 — Repair order database

This is one of the most important stages.

Implement the WorkShopOS Repair Order database foundation.

Create the schema required for:

- repair orders
- repair order numbers
- customer relationship
- vehicle relationship
- branch relationship
- assigned staff
- intake information
- repair status
- priority
- dates
- estimated completion date

Implement the lifecycle defined below.

### Primary Repair Stages

Every repair order has one and only one primary repair stage at a time. Some supporting work may occur in parallel where permitted by the workflow, but parallel work must not create multiple primary stages for the same repair order.

The eight primary repair stages are, in this exact order:

1. Disassembly
2. Parts Ordering
3. Panel Beating
4. Paint Preparation
5. Painting
6. Assembly
7. Outwork/Polishing
8. Final Inspection

These stage names and their order are authoritative. They must be used consistently by the database schema, state machine, API, services, and user interface. Do not rename, reorder, remove, or invent primary repair stages without an explicit PRD change.

Do not invent additional primary stages.

Create database constraints preventing invalid state values.

Implement indexes for operational queries.

Implement RLS.

Do not create UI yet.
Stage 19 — Repair-order state machine
Implement the WorkShopOS repair-order workflow state machine.

Use the exact lifecycle defined in PRD.md.

Implement:

- valid states
- allowed transitions
- transition validation
- transition timestamps
- transition history
- actor tracking

Invalid transitions must be rejected server-side.

Do not allow the browser to directly change status.

Add comprehensive tests for every valid and invalid transition.

Do not implement UI.
Stage 20 — Repair-order service
Implement the Repair Order service layer.

Operations:

- create repair order
- retrieve repair order
- update permitted fields
- assign technician
- change status
- retrieve history
- retrieve customer/vehicle context

Every operation must:

- authenticate
- authorize
- validate
- enforce tenant/branch boundaries
- produce audit information where required

Do not build UI.
Stage 21 — Repair-order API
Implement Repair Order API endpoints according to API_CONTRACTS.md.

Implement:

- list
- get
- create
- update
- assignment
- workflow transition
- history

Requirements:

- pagination
- filtering
- search
- validation
- RBAC
- state-machine enforcement
- standardized errors
- tenant isolation

Add integration tests.

Do not implement estimates or parts.
Stage 22 — Repair-order UI
Implement the Repair Order UI.

Create:

- repair-order list
- filters
- search
- status indicators
- create repair order
- repair-order detail page
- customer/vehicle summary
- assignment
- workflow/status controls

The UI must clearly communicate:

- current status
- next permitted actions
- assigned technician
- priority
- dates

Do not implement estimates, parts or invoicing.
PHASE 4 — VEHICLE INTAKE & COLLISION ASSESSMENT
Stage 23 — Vehicle intake
Implement the vehicle intake feature.

Capture the required information defined in PRD.md:

- vehicle arrival
- mileage
- keys
- customer concerns
- visible damage
- existing damage
- accessories
- intake notes
- intake date/time
- responsible employee

Store data through the service layer.

Do not introduce direct UI-to-database mutations.

Add validation and tests.
Stage 24 — Damage assessment
Implement the collision damage assessment domain.

Support:

- damage areas
- damage descriptions
- severity where defined
- assessment notes
- assessment status
- assessor
- timestamps

Follow PRD.md.

Do not implement AI damage detection.

Do not implement image recognition.

Build the deterministic/manual assessment workflow first.

Add database, service and API tests.
Stage 25 — Photo management
Implement WorkShopOS repair-order photo management.

Use Supabase Storage.

Support:

- upload
- metadata
- repair-order association
- category
- caption
- uploaded-by
- timestamp
- deletion where authorized

Security requirements:

- storage paths must be tenant-aware
- users cannot access another tenant's files
- validate file type
- validate file size
- prevent arbitrary executable uploads
- do not expose private storage unnecessarily

Add upload and authorization tests.

Do not implement image AI.
Stage 26 — Photo UI
Implement the repair-order photo interface.

Create:

- photo upload
- camera/mobile-friendly upload
- gallery
- categories
- captions
- preview
- delete confirmation
- loading states
- upload errors

Optimize for mobile technicians.

Do not introduce a heavy image-processing dependency.

Do not implement AI image analysis.
PHASE 5 — ESTIMATING
Stage 27 — Estimate database
Implement the Estimate domain.

Support:

- estimate
- estimate lines
- labour lines
- parts lines
- miscellaneous charges where defined
- tax
- discounts where defined
- totals
- estimate status
- versioning

Money must never use floating-point arithmetic.

Use the monetary strategy defined in ARCHITECTURE.md.

Implement database constraints.

Do not implement invoices yet.
Stage 28 — Estimate calculation engine
Implement the deterministic estimate calculation engine.

Inputs:

- labour lines
- parts
- quantities
- rates
- discounts
- taxes
- fees where defined

Outputs:

- subtotal
- discount
- taxable amount
- tax
- grand total

Requirements:

- deterministic calculations
- no floating-point money errors
- unit tests
- edge-case tests
- rounding rules
- zero-value handling

Do not build UI.

Do not connect to external accounting systems.
Stage 29 — Estimate UI
Implement the Estimate UI.

Create:

- estimate list
- estimate editor
- labour lines
- parts lines
- totals
- tax
- discount
- estimate status
- version information

Every total displayed must originate from the authoritative calculation engine.

Do not perform independent financial calculations in React.

Add tests for displayed totals.
Stage 30 — Supplement workflow
Implement repair-order supplements.

Support:

- supplement creation
- reason
- additional damage
- additional parts
- additional labour
- revised estimate
- approval status
- approval history

Follow the authorization rules in RBAC_PERMISSION_MATRIX.md.

Do not modify the original estimate destructively.

Preserve history/versioning.

Add workflow tests.
PHASE 6 — PARTS & LABOUR
Stage 31 — Parts management
Implement the Parts domain.

Support the requirements in PRD.md:

- parts catalogue
- OEM/aftermarket designation where applicable
- supplier
- part number
- cost
- selling price
- availability
- order status
- repair-order allocation

Implement:

- database
- RLS
- service
- API
- validation
- tests

Do not implement supplier integrations.
Stage 32 — Labour management
Implement Labour management.

Support:

- labour operations
- technician assignment
- labour category
- estimated hours
- actual hours
- labour rate
- status

Ensure monetary calculations use the central calculation strategy.

Do not create independent pricing logic in UI components.

Add service and API tests.
Stage 33 — Technician workflow
Implement the technician workflow.

Technicians must be able to:

- view assigned repair orders
- view required work
- update permitted progress
- record labour
- add notes
- view relevant photos
- update permitted workflow status

Technicians must NOT be able to:

- modify financial records unless explicitly permitted
- change customer ownership
- modify RBAC
- access unrelated organisations
- bypass repair-order workflow

Enforce restrictions server-side.

Optimize the interface for mobile devices.
PHASE 7 — QUALITY CONTROL & COMPLETION
Stage 34 — Inspection/QC
Implement the Quality Control inspection module.

Support:

- inspection checklist
- checklist items
- pass/fail/NA where defined
- notes
- inspector
- timestamp
- reinspection
- inspection history

The system must preserve historical inspections.

Do not overwrite previous inspection results.

Add tests for incomplete and failed inspections.
Stage 35 — Repair completion workflow
Implement the repair completion workflow.

A repair order must only be considered complete when the required completion conditions defined in PRD.md are satisfied.

Validate:

- required inspections
- required workflow stages
- required documentation
- outstanding tasks
- approval requirements

Do not simply allow a status dropdown to mark a repair complete.

Enforce all completion rules server-side.

Add comprehensive workflow tests.
PHASE 8 — CUSTOMER & FINANCE
Stage 36 — Customer portal
Implement the customer-facing portal.

Customers may view only information explicitly allowed by PRD.md.

Support:

- repair status
- vehicle
- approved information
- selected photos
- documents where authorized
- communication/status updates

Customers must never access:

- internal notes
- employee information beyond what is explicitly allowed
- internal pricing data unless authorized
- other customers
- internal audit logs
- administrative functions

Enforce this through server authorization and RLS.

Do not rely on hidden UI elements for security.
Stage 37 — Invoice generation
Implement invoicing.

Create:

- invoice
- invoice lines
- totals
- taxes
- invoice number
- invoice status
- issue date
- due date
- repair-order association

Invoices must be immutable after finalization except through explicit correction mechanisms.

Do not allow normal users to modify finalized financial records.

Use the authoritative calculation engine.

Add financial integrity tests.
Stage 38 — Payments
Implement payment recording.

Support:

- payment
- payment method
- amount
- date
- reference
- invoice association
- payment status

Do not integrate a payment gateway yet.

Implement internal payment recording only.

Prevent overpayment unless explicitly supported by PRD.md.

Financial operations must be audited.

Add comprehensive tests.
PHASE 9 — OPERATIONS
Stage 39 — Workshop dashboard
Implement the WorkShopOS operational dashboard.

Display only data the current user is authorized to see.

Include appropriate operational metrics such as:

- active repair orders
- vehicles in workshop
- awaiting assessment
- awaiting parts
- repairs in progress
- QC pending
- completed repairs
- overdue repairs

Do not create expensive database queries directly from React.

Use optimized server-side queries.

Add loading, empty and error states.

Ensure mobile responsiveness.

Do not add arbitrary metrics not defined by the product requirements.
Stage 40 — Audit, security, performance & production hardening

This is the final stage before calling the MVP production-ready.

Perform a production-readiness review of WorkShopOS.

Do NOT add new product functionality.

Audit:

SECURITY
- authentication
- authorization
- RBAC
- RLS
- tenant isolation
- storage security
- input validation
- file uploads
- secret handling
- API abuse
- error leakage

DATABASE
- indexes
- foreign keys
- constraints
- migrations
- query efficiency
- tenant isolation
- soft deletion

APPLICATION
- TypeScript errors
- React errors
- server/client boundaries
- error handling
- loading states
- empty states
- accessibility
- responsive design

PERFORMANCE
- unnecessary dependencies
- excessive client components
- unnecessary requests
- N+1 queries
- large bundles
- image optimization
- caching opportunities

TESTING
- unit tests
- integration tests
- workflow tests
- RBAC tests
- RLS tests
- critical E2E flows

Run:

npm run lint
npm run typecheck
npm test
npm run build

Do not rewrite working architecture merely for stylistic reasons.

Produce a production-readiness report containing:

1. Critical issues
2. High-priority issues
3. Medium-priority issues
4. Low-priority issues
5. Recommended fixes
6. Security risks
7. Performance risks
8. Remaining technical debt

Do not claim production readiness if critical issues remain.
The actual development order

The 40 stages can be visualised as:

FOUNDATION
│
├── 01 Repository audit
├── 02 Engineering guardrails
├── 03 Environment
├── 04 Supabase foundation
│
SECURITY
│
├── 05 Identity database
├── 06 Authentication
├── 07 Organisation/branch
├── 08 RBAC
├── 09 RLS security
├── 10 Application shell
│
CORE DATA
│
├── 11 Customers DB
├── 12 Customer service
├── 13 Customer API
├── 14 Customer UI
│
├── 15 Vehicles DB
├── 16 Vehicle service/API
├── 17 Vehicle UI
│
REPAIR OPERATIONS
│
├── 18 Repair-order DB
├── 19 State machine
├── 20 Repair-order service
├── 21 Repair-order API
├── 22 Repair-order UI
│
COLLISION
│
├── 23 Vehicle intake
├── 24 Damage assessment
├── 25 Photos
├── 26 Photo UI
│
ESTIMATING
│
├── 27 Estimate DB
├── 28 Calculation engine
├── 29 Estimate UI
├── 30 Supplements
│
WORKSHOP
│
├── 31 Parts
├── 32 Labour
├── 33 Technician workflow
│
QUALITY
│
├── 34 QC
├── 35 Completion workflow
│
CUSTOMER/FINANCE
│
├── 36 Customer portal
├── 37 Invoicing
├── 38 Payments
│
OPERATIONS
│
├── 39 Dashboard
└── 40 Production hardening
The most important rule for vibe coding

Add this to the bottom of AGENTS.md:

## Vibe Coding Execution Rules

The AI agent MUST NOT implement the entire application from a single prompt.

The AI agent MUST work in controlled vertical slices.

Before modifying code:

1. Read AGENTS.md.
2. Read relevant PRD sections.
3. Read ARCHITECTURE.md.
4. Read API_CONTRACTS.md.
5. Read RBAC_PERMISSION_MATRIX.md.
6. Inspect the existing implementation.
7. Identify dependencies on existing functionality.
8. State the intended changes before implementation.

The AI agent MUST NOT:

- invent database fields without justification
- invent API endpoints
- invent permissions
- invent workflow states
- bypass RLS
- bypass service layers
- expose service-role credentials
- put secrets in source code
- directly mutate Supabase from arbitrary UI components
- duplicate business logic in React components
- create mock functionality presented as production functionality
- replace working architecture without justification
- install unnecessary dependencies
- rewrite unrelated files
- modify unrelated modules
- remove tests to make builds pass
- disable linting or TypeScript checks
- use `any` to hide type errors
- silently change database migrations
- perform destructive database changes without explicit approval

For each task:

PLAN
→ IMPLEMENT
→ TEST
→ LINT
→ TYPECHECK
→ BUILD
→ REVIEW DIFF
→ REPORT

If an existing architectural decision conflicts with the requested feature,
STOP and report the conflict before implementing.

If requirements are ambiguous,
STOP and identify the ambiguity rather than inventing behaviour.

If implementation requires changes outside the current task scope,
STOP and report them separately.

The smallest correct implementation is preferred over speculative functionality.

Never claim a feature is complete unless it has been tested.
The "stop condition" that makes this approach work

At the end of every prompt, you can additionally append:

STOP CONDITION:

Do not proceed to the next feature.

After implementation, provide:

1. Files changed
2. Files created
3. Database changes
4. API changes
5. Security implications
6. Tests added
7. Commands executed
8. Test results
9. Remaining issues
10. Suggested next stage

Wait for further instructions.

That last instruction is particularly important for vibe coding. It turns the AI from an autonomous "build everything" generator into a controlled engineering assistant.

The result should be a WorkShopOS codebase where every major feature has a traceable path from PRD → database → security → service → API → UI → tests, rather than a collection of AI-generated screens that happen to look like an autobody management system.
