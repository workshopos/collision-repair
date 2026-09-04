# WorkShopOS AI coding guide

## Project at a glance

This repo is a Next.js + TypeScript application for a mobile-first autobody repair platform. The product is multi-tenant, RBAC-driven, and built around ongoing repair orders, workflow transitions, estimates, supplements, parts, invoices, and customer/vehicle records.

Source-of-truth docs:

- [PRD.md](PRD.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API_CONTRACTS.md](API_CONTRACTS.md)
- [RBAC_PERMISSION_MATRIX.md](RBAC_PERMISSION_MATRIX.md)
- [README.md](README.md)

## Core rules for AI agents

- Read the relevant project docs before changing behavior or architecture.
- Inspect existing implementation and package scripts before patching.
- Prefer small, reversible changes over large rewrites.
- Do not invent database columns, permissions, routes, roles, workflow states, or env vars that are not already defined.
- Keep tenant isolation, authorization, and auditability in every change.
- Trust server-side validation and database constraints over client data.
- Never put business logic in React components or raw SQL in UI code.

## Tech and architecture

- Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui patterns, TanStack Query
- Supabase + PostgreSQL with RLS for tenant-safe data access
- API-first architecture under `/api/v1`
- Modular monolith structure; keep features under `src/modules/*`
- Validation via Zod, authorization via RBAC checks, service/repository layering
- Avoid new dependencies unless the repo already has a clear need

## Expected code layout

- `app/` for app routes and entry points
- `src/modules/` for domain modules such as customers, vehicles, repair-orders, workflow, invoices, payments, etc.
- `src/lib/` for shared auth, RBAC, validation, database, storage, and error helpers
- `src/components/` for reusable UI components
- `tests/` for integration/unit coverage

Preferred flow:

- Route or API handler
- validation
- authorization
- service
- repository
- database

## Security and data integrity guardrails

- Do not trust client-supplied `organisation_id`, `branch_id`, `user_id`, `role`, status, pricing, or totals.
- Enforce server-side RBAC and tenant checks; do not rely on frontend hiding buttons.
- Validate all request bodies, params, and query strings with Zod.
- Use secure patterns for uploads and avoid exposing raw DB errors.
- Preserve audit trails for sensitive actions and workflow changes.
- Do not create destructive operations without explicit confirmation or reason capture.

## Repository reality and commands

Current repo scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run lint:fix`
- `npm run typecheck`

There is no `npm run test` script in this repo yet, so use the available verification commands and add focused tests for the behavior you change when relevant.

Before declaring a feature complete, validate the relevant checks with the smallest command that exercises the change.

## Implementation expectations

- Build vertically: database, validation, authorization, service, API, frontend client, UI, tests.
- Keep mobile-first UX and touch-friendly interactions in mind.
- Do not bypass the existing architecture just to make code faster to write.
- Favor small, correct, and maintainable fixes over generic abstractions.

## Good default behavior for this repo

- Keep API routes under the app’s versioned API pattern.
- Store business rules in service layers, not in route handlers or UI components.
- Use explicit action endpoints for state transitions instead of arbitrary generic patch updates.
- Ensure cross-tenant and cross-branch access is prevented in both application logic and database policies.
- Prefer existing patterns and modules over new implementations of the same domain logic.

# 8. Database Rules

PostgreSQL is the source of truth.

Never treat frontend state as authoritative.

Never calculate critical financial values only in the browser.

Never trust:

- organisation_id
- branch_id
- user_id
- role
- permissions
- prices
- totals
- status
- approval state

when supplied by the client.

The server must derive or validate these values.

---

# 9. Multi-Tenant Security

WorkShopOS must support multiple organisations.

Every tenant-owned record must be associated with an organisation.

Typical structure:

organisation
↓
branch
↓
users / customers / vehicles / repair orders

Users must only access data belonging to their organisation.

Branch-level restrictions must also be enforced where applicable.

Never rely exclusively on frontend filtering.

Never rely exclusively on API checks.

Use:

1. Application-level authorization
2. PostgreSQL RLS

---

# 10. RLS Rules

RLS must be enabled on all tenant-sensitive tables.

Example conceptual policy:

authenticated user
↓
membership
↓
organisation
↓
record.organisation_id

A user must never be able to access another organisation's records by changing an ID in the URL.

Always test:

- same organisation access
- different organisation access
- same branch access
- different branch access
- unauthorized access
- revoked membership

---

# 11. Authentication

Use Supabase Auth.

Never store passwords manually.

Never expose Supabase service-role keys to the browser.

Public environment variables may contain:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

The service-role key must only exist server-side.

Example:

SUPABASE_SERVICE_ROLE_KEY

Never commit secrets to Git.

---

# 12. Environment Variables

Use:

.env.local

Never commit:

.env.local

Maintain:

.env.example

Example:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

Additional third-party keys should only be added when required.

Never hard-code API keys.

---

# 13. RBAC

All protected functionality must use permissions.

Do not implement security using role names alone.

Preferred:

permission:
repair_order.transition

rather than:

if user.role === "manager"

Roles should aggregate permissions.

Example:

Workshop Manager
↓
repair_order.view
repair_order.create
repair_order.update
repair_order.transition
repair_order.assign
estimate.approve
supplement.approve
qc.complete
etc.

The authoritative permission list is defined in:

RBAC_PERMISSION_MATRIX.md

---

# 14. Authorization

Authorization must occur server-side.

Example:

await authorization.require(
user,
"repair_order.transition",
repairOrder
);

The frontend may hide unavailable actions for usability.

However:

Hiding a button is NOT security.

The API must reject unauthorized requests.

---

# 15. API Rules

API prefix:

/api/v1

Use REST-style APIs.

Examples:

GET /api/v1/repair-orders
POST /api/v1/repair-orders
GET /api/v1/repair-orders/:id
PATCH /api/v1/repair-orders/:id

Business actions should use explicit action endpoints:

POST /api/v1/repair-orders/:id/transition
POST /api/v1/repair-orders/:id/override-transition

Do not allow arbitrary status modification through generic PATCH endpoints.

---

# 16. API Response Format

Successful single-resource response:

{
"data": {}
}

Successful collection:

{
"data": [],
"meta": {
"page": 1,
"page_size": 25,
"total": 0
}
}

Error:

{
"error": {
"code": "FORBIDDEN",
"message": "You do not have permission to perform this action.",
"request_id": "uuid"
}
}

Never expose raw database errors.

---

# 17. Validation

All external input must be validated.

Use Zod.

Example:

const schema = z.object({
customer_id: z.string().uuid(),
vehicle_id: z.string().uuid(),
priority: z.enum([
"low",
"normal",
"high",
"urgent"
])
});

Validate:

- body
- query parameters
- route parameters
- file metadata
- imported data

TypeScript compilation is not runtime validation.

---

# 18. Repair Order Workflow

The canonical workflow is:

draft
→ intake
→ assessment
→ awaiting_authorisation
→ authorised
→ disassembly
→ parts_ordering
→ panel_beating
→ paint_preparation
→ painting
→ assembly
→ outwork
→ final_inspection
→ ready_for_collection
→ collected
→ closed

Alternative:

cancelled

Do not allow arbitrary state changes.

Workflow transitions must be controlled by the Workflow Service.

---

# 19. Workflow State Machine

Every transition must verify:

- current state
- requested state
- user permission
- prerequisites
- outstanding work
- approval requirements
- QC requirements
- financial requirements

The frontend must never be responsible for enforcing workflow integrity.

---

# 20. Workflow Audit

Every state transition must generate an audit event.

Example:

repair_order.stage_changed

Record:

- actor
- organisation
- branch
- repair order
- previous state
- new state
- timestamp
- reason where applicable

Overrides require an explicit reason.

---

# 21. Financial Rules

Never trust client-supplied totals.

Server calculates:

subtotal
discount
tax
total
balance

Example:

subtotal =
sum(line_items)

tax =
subtotal × tax_rate

total =
subtotal + tax - discount

Financial calculations must be tested.

Use decimal-safe database types.

Do not use floating-point arithmetic for persisted money values.

---

# 22. Estimates

Estimates should support versions.

Example:

estimate
├── version 1
├── version 2
└── version 3

Once submitted or approved, versions should become immutable.

Changes create a new version.

---

# 23. Supplements

Supplements must retain:

- reason
- original estimate reference
- additional items
- supporting photos
- supporting documents
- approval history

Do not overwrite historical approval information.

---

# 24. Parts

Parts lifecycle:

requested
→ ordered
→ backordered
→ received
→ allocated
→ fitted

Do not allow invalid transitions.

Receiving parts must be transactional.

Inventory counts must never become negative unless explicitly supported by the business rules.

---

# 25. Labour

Technicians may:

- start timers
- stop timers
- submit labour entries

Users should normally only modify their own labour records.

Managers/admins may have broader permissions according to RBAC.

Prevent overlapping active timers unless explicitly supported.

---

# 26. Photos

Photos are important operational evidence.

Use Supabase Storage.

Recommended flow:

API
→ signed upload URL
→ direct client upload
→ API confirms metadata

Do not send large image files through normal API requests unnecessarily.

Store metadata in PostgreSQL.

Storage path should include tenant context.

Example:

organisation/
branch/
repair-order/
photos/

---

# 27. File Security

Never trust:

- filename
- extension
- MIME type
- client file size

Validate uploads server-side.

Set reasonable limits.

Do not allow executable files where they are not required.

Never make private repair documents publicly accessible.

Use signed URLs for protected files.

---

# 28. Audit Logging

Sensitive operations must generate audit events.

Examples:

- login/security changes
- role changes
- permission changes
- repair order creation
- workflow overrides
- estimate approval
- supplement approval
- invoice changes
- payment operations
- document access where appropriate
- data deletion/archive

Audit records should be append-only.

Do not allow ordinary users to edit audit records.

---

# 29. Soft Deletion

Do not physically delete important operational records by default.

Prefer:

deleted_at

or:

archived_at

for records such as:

- customers
- vehicles
- repair orders
- estimates
- documents

Financial records should normally be immutable rather than deleted.

---

# 30. Concurrency

Important records should use optimistic concurrency.

Example:

record version = 7

Client updates version 7.

If database version is already 8:

return:

409 CONFLICT

Do not silently overwrite changes.

---

# 31. Idempotency

Important mutation endpoints should support:

X-Idempotency-Key

Especially:

- payments
- invoice operations
- workflow transitions
- sync operations
- document operations

Duplicate requests must not accidentally create duplicate records.

---

# 32. Offline Support

Technician workflows should support limited offline operation.

Offline-capable functionality may include:

- viewing assigned jobs
- viewing cached repair information
- capturing photographs
- entering notes
- recording labour
- queueing permitted mutations

Do not assume every action can safely work offline.

Financial and high-risk approval operations may require an online connection.

---

# 33. Sync

Offline mutations should contain:

- mutation_id
- entity
- entity_id
- operation
- payload
- client_created_at

Server response should identify:

- applied
- already_applied
- rejected
- conflict
- retry

Never blindly overwrite newer server data.

---

# 34. UI/UX

WorkShopOS is mobile-first.

Minimum supported design width:

360px

Target:

360–390px mobile baseline.

Desktop layouts should scale upward.

Use:

- clear hierarchy
- large touch targets
- concise labels
- status badges
- progressive disclosure
- minimal visual clutter
- consistent spacing
- keyboard accessibility

---

# 35. Design Language

WorkShopOS should feel:

- professional
- modern
- operational
- trustworthy
- lightweight

Avoid:

- excessive gradients
- unnecessary animation
- oversized cards
- visual clutter
- excessive modals
- decorative UI without purpose

Use colour primarily to communicate state.

---

# 36. Responsive Navigation

Mobile:

bottom navigation

Desktop:

left sidebar

Suggested navigation:

Dashboard
Repair Orders
Vehicles
Customers
Parts
Tasks
Inspections
Invoices
Reports
Settings

Only display navigation items the user has permission to access.

---

# 37. Repair Order UI

A repair order should provide a clear operational view.

Recommended sections:

Header
↓
Vehicle
↓
Customer
↓
Repair status
↓
Progress timeline
↓
Tasks
↓
Parts
↓
Photos
↓
Estimate
↓
Supplements
↓
QC
↓
Invoice
↓
Activity/Audit

---

# 38. Dashboard

The dashboard should answer:

- What needs attention?
- Which vehicles are currently in repair?
- Which jobs are delayed?
- Which jobs await approval?
- Which parts are outstanding?
- Which vehicles are ready?
- What requires QC?
- What requires payment?

Avoid dashboards containing meaningless metrics.

---

# 39. Performance

Prioritize lightweight performance.

Do not:

- load entire datasets
- render thousands of rows
- fetch unnecessary columns
- load huge images immediately
- install large libraries unnecessarily

Use:

- pagination
- lazy loading
- image optimization
- caching
- server-side filtering
- indexed queries

---

# 40. Database Indexing

Add indexes for common queries.

Examples:

repair_orders:

- organisation_id
- branch_id
- status
- assigned_to
- created_at
- vehicle_id

vehicles:

- organisation_id
- registration
- vin
- customer_id

customers:

- organisation_id
- phone
- email

Do not add indexes blindly.

Measure query patterns.

---

# 41. Database Migrations

All schema changes must be migrations.

Never manually alter production schema without a migration.

Migration names should be descriptive.

Example:

202608270001_create_customers.sql

202608270002_create_vehicles.sql

202608270003_create_repair_orders.sql

Test migrations from a clean database.

---

# 42. Seed Data

Development seed data may include:

Organisation:
Demo AutoBody

Branches:

- Johannesburg Workshop

Users:

- Admin
- Workshop Manager
- Estimator
- Technician
- Painter
- Parts Controller
- QC Inspector
- Accountant
- Customer

Never use real customer information in seed data.

---

# 43. Testing Requirements

Every business-critical feature requires tests.

Minimum:

Unit tests:

- validation
- workflow rules
- calculations
- permissions

Integration tests:

- database operations
- RLS
- API endpoints

End-to-end:

- login
- create customer
- create vehicle
- create repair order
- move repair order through workflow
- estimate
- parts
- QC
- invoice
- collection

---

# 44. Security Testing

Explicitly test:

- unauthenticated API access
- cross-tenant access
- cross-branch access
- privilege escalation
- direct object reference attacks
- invalid workflow transitions
- unauthorized approvals
- duplicate payments
- malformed uploads
- oversized uploads
- XSS vectors
- CSRF where applicable
- injection attempts

---

# 45. Accessibility

Target WCAG 2.2 AA where practical.

Ensure:

- keyboard navigation
- visible focus
- sufficient contrast
- semantic HTML
- labels for forms
- accessible error messages
- screen-reader-friendly controls
- touch targets of appropriate size

Do not rely on colour alone to communicate status.

---

# 46. Error Handling

Never leave users with:

"Something went wrong."

Instead provide:

- understandable message
- retry action
- relevant context
- support/request ID when appropriate

Example:

"Unable to save the repair order. Your connection may have been interrupted. Please retry."

Log technical details server-side.

---

# 47. Logging

Use structured server-side logging.

Never log:

- passwords
- access tokens
- API secrets
- payment credentials
- unnecessary personal data

Include:

- request ID
- user ID where appropriate
- organisation ID
- operation
- duration
- error code

---

# 48. API Client

Do not scatter raw fetch calls across React components.

Use:

src/lib/api/

Example:

api/
├── client.ts
├── customers.ts
├── vehicles.ts
├── repair-orders.ts
├── estimates.ts
├── parts.ts
├── inspections.ts
├── invoices.ts
└── sync.ts

Components should call typed functions.

---

# 49. React Rules

Prefer:

- Server Components where appropriate
- Client Components only when interactivity is required
- reusable components
- controlled forms
- schema-based validation

Avoid:

- huge components
- global state for everything
- unnecessary useEffect
- duplicated API logic
- duplicated business rules

---

# 50. State Management

Do not introduce Redux unless genuinely required.

Use:

Server state:
TanStack Query

Local UI state:
React state

Forms:
React Hook Form + Zod where useful

Authentication:
Supabase/session context

---

# 51. Component Rules

Reusable components should be created when the same UI pattern appears more than once.

Examples:

StatusBadge
RepairOrderCard
VehicleSummary
CustomerSummary
PermissionGate
DataTable
EmptyState
ErrorState
LoadingState
ConfirmDialog

Do not create components merely to make files smaller.

---

# 52. Loading States

Every asynchronous screen should provide an appropriate loading state.

Prefer skeletons for data-heavy interfaces.

Avoid indefinite spinners.

---

# 53. Empty States

Every list must have an intentional empty state.

Example:

"No repair orders yet."

Provide a relevant action:

"Create Repair Order"

---

# 54. Destructive Actions

Actions such as:

- delete
- archive
- void
- refund
- cancel

require confirmation.

Where appropriate require a reason.

Do not place destructive actions next to common actions without visual distinction.

---

# 55. Customer Data

Treat customer information as private.

Only expose information required by the current user and role.

Do not expose unnecessary personal information in:

- logs
- analytics
- URLs
- error messages
- client-side metadata

---

# 56. Financial Data

Financial operations require additional authorization.

Do not allow technicians to:

- modify invoices
- approve payments
- issue refunds

unless explicitly authorised.

---

# 57. Approval Separation

Where practical, separate:

creator
from
approver

especially for:

- estimates
- supplements
- financial adjustments

Implement according to the RBAC matrix.

---

# 58. AI Coding Rules

AI-generated code must be reviewed.

Never accept an AI-generated implementation simply because it compiles.

For every change inspect:

- security
- data flow
- validation
- authorization
- database access
- error handling
- performance
- mobile behaviour

---

# 59. AI Must Not Invent

Do not invent:

- database columns
- API endpoints
- permissions
- business rules
- roles
- workflow states
- environment variables

If something is unclear:

1. inspect existing documentation/code;
2. infer only when safe;
3. otherwise stop and identify the ambiguity.

Do not silently fabricate architecture.

---

# 60. Dependency Policy

Before installing a package ask:

1. Is it necessary?
2. Is existing functionality sufficient?
3. Is it actively maintained?
4. Does it increase bundle size significantly?
5. Does it introduce security concerns?
6. Does it complicate deployment?

Prefer established lightweight libraries.

---

# 61. Git Rules

Use small commits.

Examples:

feat(repair-orders): add repair order creation

feat(workflow): implement repair order transitions

fix(rbac): prevent cross-branch access

fix(parts): prevent negative inventory

test(workflow): add transition tests

Do not commit:

- .env files
- secrets
- generated credentials
- local databases
- node_modules

---

# 62. Branching

Recommended:

main
develop
feature/_
fix/_

For solo development, a simpler approach is acceptable:

main
feature/\*

Never develop directly on production.

---

# 63. Before Coding

Every AI coding session should begin with:

1. Read AGENTS.md.
2. Read relevant PRD section.
3. Read architecture.
4. Inspect existing implementation.
5. Identify affected modules.
6. Identify database changes.
7. Identify API changes.
8. Identify RBAC changes.
9. Create an implementation plan.

Do not immediately start generating code.

---

# 64. Implementation Strategy

Build WorkShopOS vertically.

Recommended order:

PHASE 1
Authentication
Organisation
Branch
RBAC

PHASE 2
Customers
Vehicles

PHASE 3
Repair Orders
Workflow

PHASE 4
Technician Jobs
Assignments
Labour

PHASE 5
Photos
Documents

PHASE 6
Estimates
Supplements

PHASE 7
Parts

PHASE 8
Inspections/QC

PHASE 9
Invoices
Payments

PHASE 10
Notifications
Reporting

PHASE 11
Offline Sync

Do not attempt to implement every module simultaneously.

---

# 65. Vertical Slice Rule

Each feature should be implemented end-to-end.

Example:

Repair Order creation:

Database
→ migration
→ RLS
→ permission
→ schema
→ repository
→ service
→ API
→ API client
→ UI
→ tests

Only after the slice is stable should the next feature be started.

---

# 66. Definition of Done

A feature is NOT complete until:

[ ] Database migration exists
[ ] Database indexes considered
[ ] RLS implemented
[ ] RBAC permission defined
[ ] Validation implemented
[ ] Service layer implemented
[ ] Repository implemented
[ ] API implemented
[ ] Error handling implemented
[ ] Audit requirements implemented
[ ] Frontend API client implemented
[ ] UI implemented
[ ] Loading state implemented
[ ] Empty state implemented
[ ] Error state implemented
[ ] Mobile responsive
[ ] Accessibility considered
[ ] Unit tests passing
[ ] Integration tests passing where applicable
[ ] No TypeScript errors
[ ] No lint errors
[ ] No secrets committed
[ ] Existing functionality still works

---

# 67. Verification Commands

Before declaring a feature complete, run:

npm run lint

npm run typecheck

npm run test

npm run build

If available:

npm run test:e2e

Do not report success unless the relevant checks actually pass.

---

# 68. Linux Mint Development

The developer environment is Linux Mint.

Do not provide Windows-specific commands unless specifically requested.

Preferred commands:

npm install
npm run dev
npm run lint
npm run build

Supabase CLI may be used when required.

Avoid Docker-based workflows unless explicitly requested.

---

# 69. Local Development

Default application:

http://localhost:3000

Start:

npm run dev

Build:

npm run build

Production test:

npm start

Before starting development verify:

node --version
npm --version

---

# 70. AI Vibe-Coding Workflow

Use the following workflow with any coding agent:

STEP 1
Open the WorkShopOS repository.

STEP 2
Read:

AGENTS.md
PRD.md
ARCHITECTURE.md
API_CONTRACTS.md
RBAC_PERMISSION_MATRIX.md

STEP 3
Ask the AI:

"Inspect the existing WorkShopOS repository. Do not modify files. Explain the current architecture, identify missing pieces, and propose the smallest implementation plan for the requested feature."

STEP 4
Review the plan.

STEP 5
Ask the AI to implement only the approved feature.

STEP 6
Run:

npm run lint
npm run typecheck
npm run test
npm run build

STEP 7
Fix failures.

STEP 8
Review the diff.

STEP 9
Commit.

STEP 10
Move to the next vertical slice.

---

# 71. Recommended AI Prompt

Use:

"Read AGENTS.md and the relevant WorkShopOS architecture documents first.

Inspect the existing implementation before making changes.

Implement only the requested feature.

Do not redesign unrelated parts of the application.

Follow the existing architecture.

Implement the complete vertical slice:

database
RLS
RBAC
validation
repository
service
API
frontend API client
UI
loading/error/empty states
tests

Do not bypass security controls.

Do not expose secrets.

Do not invent database fields or permissions.

After implementation, run lint, typecheck, tests and build.

Report:

1. files changed
2. database changes
3. API changes
4. RBAC changes
5. tests performed
6. remaining issues."

---

# 72. Debugging Workflow

When an error occurs:

DO NOT immediately rewrite the feature.

First:

1. Read the complete error.
2. Identify the first meaningful error.
3. Identify affected file.
4. Inspect surrounding code.
5. Determine whether the error is:
   - TypeScript
   - dependency
   - database
   - RLS
   - authentication
   - API
   - UI
   - build
6. Fix the smallest root cause.
7. Re-run the relevant check.

Do not hide errors with:

- any
- @ts-ignore
- eslint-disable
- empty catch blocks

unless there is a documented reason.

---

# 73. TypeScript Rules

Strict TypeScript should be used.

Avoid:

any

Prefer:

unknown

then validate/narrow the value.

Do not disable strict compiler settings simply to make code compile.

---

# 74. Database Error Rules

Never expose raw PostgreSQL errors.

Convert:

database error

into:

appropriate application error.

Example:

unique constraint

→

DUPLICATE

foreign key violation

→

INVALID_REFERENCE

RLS rejection

→

FORBIDDEN or NOT_FOUND

depending on context.

---

# 75. Performance Budget

The MVP should remain lightweight.

Avoid unnecessary:

- animations
- dependencies
- client-side JavaScript
- API requests
- database queries
- image downloads

Prefer server rendering where appropriate.

---

# 76. Mobile-First Rule

Every feature must be tested at:

360px
390px
768px
1024px
1440px

Do not design desktop first and attempt to retrofit mobile later.

Technicians will primarily interact with the system on mobile devices.

---

# 77. PWA Principles

Where PWA functionality is implemented:

- cache application shell
- cache safe read-only data
- support offline indicators
- queue supported mutations
- sync when connection returns

Do not cache sensitive information unnecessarily.

Never expose another user's data through a shared browser cache.

---

# 78. Security Priority

Security has priority over convenience.

If a requested implementation would weaken:

- authentication
- authorization
- tenant isolation
- RLS
- auditability
- financial integrity

do not implement it as requested.

Explain the safer implementation.

---

# 79. Production Readiness

Before production:

[ ] Authentication tested
[ ] RBAC tested
[ ] RLS tested
[ ] Tenant isolation tested
[ ] Database backups configured
[ ] Error logging configured
[ ] Environment variables configured
[ ] HTTPS enabled
[ ] Storage policies tested
[ ] Rate limiting configured
[ ] Upload limits configured
[ ] Database indexes reviewed
[ ] Financial calculations tested
[ ] Audit logging tested
[ ] E2E tests passing
[ ] Build passing
[ ] No secrets in repository

---

# 80. Final Agent Rule

Do not optimise for:

"make the code compile quickly."

Optimise for:

"make the smallest correct, secure, maintainable implementation that fits the WorkShopOS architecture."

When uncertain, favour:

security
→ data integrity
→ maintainability
→ simplicity
→ performance
→ convenience

WorkShopOS must remain a lightweight modular monolith until real scale justifies architectural expansion.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
