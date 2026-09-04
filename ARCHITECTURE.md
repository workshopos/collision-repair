# WorkShopOS — System Architecture

## Progress checklist

- [x] Modular monolith architecture is documented and reflected in the repository structure.
- [x] Technology stack and layer boundaries are defined.
- [x] Identity and tenant foundation is implemented and aligned with the architecture.
- [x] Auth and DB foundation files exist and match the intended architecture.
- [x] Full server-side tenant-context enforcement across modules is implemented at the shared service boundary and enforced before tenant-aware business logic executes.
- [ ] Full RBAC enforcement across modules remains pending.
- [ ] Business module implementation for repair orders, workflow, finance, and inspections remains pending.

**Document:** `ARCHITECTURE.md`
**Product:** WorkShopOS
**Version:** 1.0
**Status:** Engineering Baseline
**Primary Environment:** Linux Mint
**Architecture:** Modular Monolith
**Application Type:** Multi-tenant SaaS / Responsive PWA

---

## 1. Purpose

This document defines the technical architecture for WorkShopOS, a cloud-based vehicle collision repair management system for autobody and panel-beating workshops.

The architecture translates the product requirements into an implementation structure suitable for AI-assisted/vibe coding while maintaining security, maintainability, scalability and predictable behaviour.

The supplied PRD establishes WorkShopOS as a single connected platform covering repair orders, estimating, workflow tracking, parts, damage documentation, invoicing and customer access.

This architecture is intentionally designed to support an MVP without introducing unnecessary infrastructure complexity.

---

# 2. Architecture Principles

WorkShopOS follows these principles:

1. **Mobile-first**
2. **Security by default**
3. **Database-enforced tenant isolation**
4. **Server-side business rules**
5. **Modular monolith before microservices**
6. **API/service boundaries even inside the monolith**
7. **PostgreSQL as the system of record**
8. **Object storage for photographs and documents**
9. **Versioned database migrations**
10. **Auditable business operations**
11. **Progressive enhancement**
12. **Lightweight dependencies**
13. **Testable business logic**
14. **AI-assisted development with human-controlled architecture**
15. **Scalability without premature infrastructure complexity**

---

# 3. Architectural Style

WorkShopOS will use a:

> **Modular Monolith Architecture**

The entire application initially runs as one deployable web application while internal functionality is separated into well-defined modules.

```text
                    ┌─────────────────────┐
                    │      Browser        │
                    │ Desktop / Mobile    │
                    │       PWA           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Next.js        │
                    │  Application Layer  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │ UI / Pages  │      │ API / Server│      │ Auth / RBAC │
   │ Components  │      │   Actions   │      │  / Policies │
   └─────────────┘      └──────┬──────┘      └─────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Domain Services     │
                    │                     │
                    │ Repair Orders       │
                    │ Workflow            │
                    │ Estimates            │
                    │ Parts                │
                    │ Labour              │
                    │ QC                  │
                    │ Invoicing           │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
          ┌────────────┐ ┌────────────┐ ┌────────────┐
          │ PostgreSQL │ │  Storage   │ │ Realtime   │
          │ Database   │ │ Photos/PDF │ │ Events     │
          └────────────┘ └────────────┘ └────────────┘
```

---

# 4. Technology Stack

## 4.1 Frontend

```text
Next.js
TypeScript
React
Tailwind CSS
shadcn/ui
Lucide
React Hook Form
Zod
TanStack Query
TanStack Table
```

## 4.2 Backend

```text
Next.js server-side runtime
Route Handlers / Server Actions where appropriate
Domain services
Repository/data-access layer
Supabase
```

## 4.3 Database

```text
PostgreSQL
```

## 4.4 Authentication

```text
Supabase Auth
```

## 4.5 Storage

```text
Supabase Storage
```

## 4.6 Realtime

```text
Supabase Realtime
```

## 4.7 Testing

```text
Vitest
React Testing Library
Playwright
```

## 4.8 Source Control

```text
Git
GitHub
```

## 4.9 CI/CD

```text
GitHub Actions
```

---

# 5. Why Modular Monolith?

WorkShopOS does not initially require:

- Kubernetes
- Docker
- Redis
- Kafka
- Elasticsearch
- GraphQL
- microservices
- dedicated backend servers

The initial system should optimise for:

```text
simplicity
speed
maintainability
low operating cost
developer productivity
```

If WorkShopOS eventually reaches a scale where individual components require independent scaling, modules can be extracted later.

---

# 6. High-Level System Architecture

```text
                         INTERNET
                            │
                            ▼
                    ┌───────────────┐
                    │    HTTPS      │
                    │ CDN / Edge    │
                    └───────┬───────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │      Next.js        │
                 │      Web App        │
                 └─────────┬───────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
       Application      Domain         Authentication
          UI            Services           │
            │              │                │
            └──────────────┼────────────────┘
                           │
                           ▼
                 ┌─────────────────────┐
                 │      Supabase       │
                 ├─────────────────────┤
                 │ PostgreSQL          │
                 │ Auth                │
                 │ Storage             │
                 │ Realtime            │
                 └─────────────────────┘
```

---

# 7. Application Layers

WorkShopOS uses the following logical layers:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Data Access
     ↓
Infrastructure
```

---

# 8. Presentation Layer

Responsible for:

- pages
- layouts
- forms
- tables
- dashboards
- cards
- dialogs
- mobile interfaces
- loading states
- error states
- empty states

The presentation layer must not contain complex business rules.

Bad:

```text
React component
    ↓
direct database mutation
    ↓
workflow decision
```

Preferred:

```text
React component
    ↓
application action
    ↓
domain service
    ↓
database
```

---

# 9. Application Layer

Responsible for coordinating user operations.

Examples:

```text
CreateRepairOrder
UpdateRepairOrder
AssignTechnician
AssignBay
TransitionRepairOrder
CreateEstimate
CreateSupplement
OrderPart
ReceivePart
LogLabour
CompleteInspection
CreateInvoice
```

The application layer coordinates validation, authorization and domain services.

---

# 10. Domain Layer

The domain layer contains WorkShopOS business rules.

Examples:

```text
Workflow rules
Estimate calculations
Part lifecycle
QC rules
Invoice calculations
Repair-stage gates
Margin calculations
Permission decisions
```

The most important principle is:

> Business rules must not depend on React components.

---

# 11. Data Access Layer

The data access layer handles:

```text
SELECT
INSERT
UPDATE
DELETE
transactions
database queries
```

Examples:

```text
repair-order.repository.ts
estimate.repository.ts
parts.repository.ts
invoice.repository.ts
customer.repository.ts
```

Repositories should not contain UI logic.

---

# 12. Infrastructure Layer

Infrastructure includes:

```text
Supabase
PostgreSQL
Storage
Email
SMS
WhatsApp
Realtime
External estimating integrations
Accounting integrations
```

External systems should be accessed through adapters.

---

# 13. Feature Modules

WorkShopOS should be divided into feature modules.

```text
features/
├── auth/
├── organisations/
├── branches/
├── users/
├── customers/
├── vehicles/
├── repair-orders/
├── workflow/
├── estimates/
├── supplements/
├── parts/
├── labour/
├── photos/
├── documents/
├── outwork/
├── inspections/
├── invoices/
├── payments/
├── notifications/
├── customer-portal/
├── dashboard/
└── reporting/
```

Each feature should have clearly defined responsibilities.

---

# 14. Repair Order as the Central Aggregate

The Repair Order is the central operational entity.

```text
                    Repair Order
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
    Customer          Vehicle            Estimate
       │                                    │
       │                                    ▼
       │                               Supplements
       │
       └─────────────────────────────────────┐
                                             │
                         ┌───────────────────┼──────────────────┐
                         ▼                   ▼                  ▼
                       Parts              Labour              Photos
                         │                   │                  │
                         └───────────────────┼──────────────────┘
                                             ▼
                                            QC
                                             │
                                             ▼
                                          Invoice
```

---

# 15. Multi-Tenant Architecture

WorkShopOS is a multi-tenant SaaS.

The tenancy hierarchy is:

```text
Organisation
    │
    ├── Branch
    │     ├── Users
    │     ├── Bays
    │     └── Repair Orders
    │
    ├── Customers
    ├── Vehicles
    └── Reports
```

Every operational record must be associated with an organisation.

Where appropriate, records should also contain `branch_id`.

---

# 16. Tenant Isolation

Tenant isolation must occur at:

```text
UI
API
Application
Database
Storage
```

The database is the final security boundary.

A malicious client must not be able to access another organisation's records simply by modifying an ID in an HTTP request.

Supabase Row Level Security is therefore mandatory.

---

# 17. Branch Isolation

Users may have access to:

```text
one branch
multiple branches
all branches
```

Example:

```text
Technician
    → Johannesburg Branch

Branch Manager
    → Johannesburg Branch

Regional Manager
    → Johannesburg
    → Pretoria
    → Durban
```

---

# 18. Authentication Architecture

Authentication is delegated to Supabase Auth.

```text
User
 ↓
Supabase Auth
 ↓
Session
 ↓
Organisation Membership
 ↓
Role
 ↓
Permissions
 ↓
Branch Access
```

The application must never implement its own password storage.

---

# 19. Authorization

Authorization consists of:

```text
Authentication
+
Organisation membership
+
Role
+
Permission
+
Branch access
+
Resource ownership
```

Example:

```text
technician
    ↓
can_view_assigned_jobs
    ↓
Repair Order assigned to technician
    ↓
ALLOW
```

But:

```text
technician
    ↓
Repair Order assigned to another branch
    ↓
DENY
```

---

# 20. RBAC

Roles include:

```text
platform_admin
group_admin
branch_manager
workshop_manager
reception
estimator
technician
parts_controller
quality_inspector
accountant
customer
insurer
assessor
```

The permission matrix will be defined separately in `DATABASE.md` / security documentation.

---

# 21. Eight-Stage Workflow

The Repair Order workflow must implement the eight stages defined by the product requirements:

```text
1. Disassembly
2. Parts Ordering
3. Panel Beating
4. Paint Preparation
5. Painting
6. Assembly
7. Outwork / Polishing
8. Final Inspection
```

The source PRD specifies that the stages may have parallel activity while the dashboard maintains one primary stage.

---

# 22. Workflow State Machine

Workflow transitions must be handled by a dedicated service:

```text
workflow.service.ts
```

Conceptually:

```text
transitionRepairOrder()
```

The service validates:

```text
current stage
target stage
user permission
workflow gate
required parts
approval state
override permission
override reason
```

---

# 23. Workflow History

Every stage transition creates an immutable historical record.

```text
Repair Order
      │
      ├── Disassembly
      ├── Parts Ordering
      ├── Panel Beating
      ├── Paint Preparation
      ├── Painting
      ├── Assembly
      ├── Outwork
      └── Final Inspection
```

History records:

```text
from_stage
to_stage
actor_id
timestamp
note
photo
override
override_reason
```

---

# 24. Parallel Work

The workflow must distinguish:

```text
primary workflow stage
```

from:

```text
supporting activities
```

Example:

```text
Primary Stage:
Panel Beating

Parallel:
Parts Ordering
Supplement Approval
Outwork Booking
```

The dashboard still displays:

```text
Panel Beating
```

as the primary stage.

---

# 25. Physical Vehicle State

Physical location is independent of workflow stage.

Example:

```text
workflow_stage:
Outwork / Polishing

physical_location:
Off-site

outwork_provider:
Glass Specialist
```

This prevents the system from giving an inaccurate answer to:

> Where is the vehicle?

---

# 26. Workshop Resources

Resources include:

```text
bays
hoists
paint booths
technicians
specialists
outwork providers
```

Resources can later become schedulable.

The MVP should implement bay and technician assignment without attempting to build a sophisticated optimisation engine.

---

# 27. Estimating Architecture

Estimates are versioned.

```text
Estimate
   │
   ├── Version 1
   ├── Version 2
   ├── Version 3
   └── Supplement
```

Historical versions must never be silently overwritten.

---

# 28. Money Handling

Financial values must use decimal-safe representation.

Do not use JavaScript floating-point arithmetic for monetary calculations.

Prefer:

```text
PostgreSQL NUMERIC
```

and explicit server-side calculations.

---

# 29. Costing

WorkShopOS calculates:

```text
estimated revenue
actual cost
gross profit
gross margin
variance
```

Cost categories:

```text
labour
parts
paint/materials
sublet/outwork
other
```

---

# 30. Parts Architecture

Part lifecycle:

```text
NEEDED
 ↓
ORDERED
 ↓
BACKORDERED
 ↓
RECEIVED
 ↓
FITTED
```

Parts can also be:

```text
CANCELLED
RETURNED
```

Every significant part status change should be auditable.

---

# 31. Photo Architecture

Photographs must be stored in object storage.

PostgreSQL stores metadata.

```text
Photo
 ├── id
 ├── repair_order_id
 ├── storage_path
 ├── category
 ├── stage
 ├── uploaded_by
 └── created_at
```

The database must not contain large binary image payloads.

---

# 32. Photo Categories

Examples:

```text
intake
damage
vin
odometer
disassembly
panel
paint
assembly
outwork
qc
handover
```

---

# 33. Document Architecture

Documents follow a similar pattern.

Examples:

```text
estimate
supplement
insurer correspondence
approval
OEM reference
invoice
customer authorization
QC documentation
```

Metadata remains in PostgreSQL while the file itself resides in object storage.

---

# 34. Customer Portal

The customer portal is logically separated from the internal application.

```text
Internal Application
        │
        ▼
Customer Status Service
        │
        ▼
Secure Customer Token
        │
        ▼
Customer Portal
```

Customer access must be read-limited.

Customer users must never receive internal workshop permissions.

---

# 35. API Architecture

WorkShopOS may use:

```text
Next.js Server Actions
```

for suitable internal application mutations and:

```text
Next.js Route Handlers
```

for APIs, integrations and externally consumed endpoints.

API boundaries should be organised around domain operations.

Examples:

```text
POST /api/repair-orders
GET  /api/repair-orders
GET  /api/repair-orders/:id

POST /api/repair-orders/:id/transition
POST /api/repair-orders/:id/photos
POST /api/repair-orders/:id/parts

POST /api/estimates
POST /api/supplements

POST /api/invoices
```

Exact API contracts will be defined separately.

---

# 36. Service Layer

Core services:

```text
repair-order.service.ts
workflow.service.ts
estimate.service.ts
supplement.service.ts
parts.service.ts
labour.service.ts
inspection.service.ts
invoice.service.ts
payment.service.ts
notification.service.ts
customer-portal.service.ts
audit.service.ts
```

---

# 37. Repository Layer

Repositories provide database access.

Example:

```text
repair-order.repository.ts
customer.repository.ts
vehicle.repository.ts
estimate.repository.ts
parts.repository.ts
invoice.repository.ts
```

Repositories must not decide whether a user is allowed to perform an operation.

Authorization belongs in policies/application/domain layers and RLS provides the database boundary.

---

# 38. Validation Architecture

All externally supplied input must be validated.

Use Zod schemas.

```text
CreateRepairOrderSchema
UpdateRepairOrderSchema
CreateEstimateSchema
CreateEstimateItemSchema
TransitionStageSchema
CreatePartSchema
CreateInvoiceSchema
```

Validation must occur server-side.

Client-side validation improves UX but is not a security boundary.

---

# 39. Error Architecture

Standard application errors:

```text
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
CONFLICT
WORKFLOW_BLOCKED
RATE_LIMITED
INTERNAL_ERROR
```

The frontend converts these into appropriate human-readable messages.

Internal stack traces must never be displayed to end users.

---

# 40. Idempotency

Critical mutations must support idempotency where duplicate requests could cause financial or operational damage.

Examples:

```text
payment creation
invoice creation
stage transition
part receiving
offline sync
notification delivery
```

Use a:

```text
client_mutation_id
```

or equivalent idempotency key.

---

# 41. Offline Architecture

The MVP may operate online-first.

Phase 2 introduces:

```text
local mutation queue
```

Technician operations suitable for queuing:

```text
stage update
hours entry
photo upload
parts flag
issue flag
note
```

Architecture:

```text
Technician
     │
     ▼
Local Queue
     │
     ├── Online → Server
     │
     └── Offline
           │
           ▼
       Wait / Retry
```

---

# 42. Offline Conflict Handling

Each queued mutation contains:

```text
client_mutation_id
user_id
entity_id
operation
payload
created_at
```

The server must recognise duplicate mutation IDs.

This prevents:

```text
same stage update
same payment
same labour entry
```

from being created multiple times after connectivity recovery.

---

# 43. Realtime Architecture

Realtime should be selective.

Suitable realtime events:

```text
repair_order.stage_changed
part.received
technician.assigned
notification.created
```

Avoid subscribing every client to every database table.

---

# 44. Notification Architecture

Notifications use an abstraction:

```text
NotificationProvider
```

Implementations can include:

```text
EmailProvider
SmsProvider
WhatsAppProvider
```

MVP:

```text
Email
```

Future:

```text
SMS
WhatsApp
```

This prevents vendor lock-in.

---

# 45. Event Architecture

Important business events can be represented as:

```text
repair_order.created
repair_order.stage_changed
part.required
part.ordered
part.received
estimate.created
estimate.approved
supplement.created
inspection.failed
inspection.passed
vehicle.ready
invoice.issued
payment.received
```

The event architecture should initially remain lightweight.

A full message broker is not required.

---

# 46. Audit Architecture

Audit records should be generated for important business actions.

Examples:

```text
RO created
RO modified
stage changed
stage override
estimate edited
supplement created
part ordered
part received
invoice created
payment recorded
document uploaded
authorization signed
permission changed
```

Audit records should be append-only to ordinary users.

---

# 47. Database Architecture

PostgreSQL is the authoritative source for structured application data.

Core domains:

```text
Identity
Organisation
Customers
Vehicles
Repair Orders
Workflow
Estimates
Parts
Labour
Documents
Inspections
Invoices
Payments
Notifications
Audit
```

Full schema definitions belong in:

```text
DATABASE.md
```

---

# 48. Database Transactions

Transactions must be used when multiple related database operations must succeed together.

Example:

```text
Transition Stage
      │
      ├── Update RO
      ├── Insert history
      ├── Insert audit
      └── Create notification
```

Where appropriate, these operations should be atomic.

---

# 49. Database Constraints

Do not rely exclusively on application validation.

Use database constraints for:

```text
NOT NULL
UNIQUE
FOREIGN KEY
CHECK
```

Examples:

```text
unique RO number
unique organisation membership
valid invoice status
valid stage
valid currency amount
```

---

# 50. Database Indexing

Indexes should support common queries.

Initial candidates:

```text
repair_orders(branch_id)
repair_orders(current_stage)
repair_orders(status)
repair_orders(target_completion_date)
repair_orders(created_at)

stage_history(repair_order_id, created_at)

parts(repair_order_id, status)

labour_entries(repair_order_id)

photos(repair_order_id)

notifications(user_id, read_at)

audit_logs(organisation_id, created_at)
```

Indexes should be reviewed using actual query performance rather than added indiscriminately.

---

# 51. Dashboard Architecture

Dashboard queries should be purpose-built.

Avoid:

```text
load every repair order
load every part
load every photograph
load every history record
then calculate everything in React
```

Instead:

```text
Database
    ↓
Optimised queries/views
    ↓
Aggregated result
    ↓
Dashboard
```

---

# 52. Performance Target

The original PRD specifies:

> Dashboard load under two seconds for a branch with 150 active Repair Orders.

Architecture must therefore use:

```text
pagination
indexes
aggregation
lazy loading
image optimisation
server rendering where appropriate
caching
limited realtime
```

---

# 53. Frontend Rendering Strategy

Use:

```text
Server Components
```

where suitable for data-heavy read interfaces.

Use:

```text
Client Components
```

when interaction requires browser state.

Avoid turning the entire application into a client-rendered SPA unnecessarily.

---

# 54. State Management

Use the simplest appropriate state solution.

### Server state

```text
TanStack Query
```

### Local UI state

```text
React state
```

### Global client state

```text
Zustand
```

Use Zustand sparingly.

Do not store the entire database in global client state.

---

# 55. UI Architecture

Shared UI:

```text
components/ui/
```

Application layout:

```text
components/layout/
```

Domain components:

```text
features/*/components/
```

This prevents generic components from becoming a dumping ground.

---

# 56. Design System

The interface should use a controlled design system.

Core elements:

```text
Button
Input
Select
Textarea
Dialog
Drawer
Dropdown
Tabs
Card
Badge
Table
Sheet
Toast
Tooltip
Command
```

Use shadcn/ui as the foundation.

---

# 57. Mobile Architecture

Primary mobile width:

```text
360px
390px
```

Mobile navigation:

```text
Home
Jobs
Tasks
Notifications
Profile
```

Primary actions should be thumb-accessible.

---

# 58. Technician UX

Technician screens should prioritise:

```text
large controls
minimal typing
camera access
current job
current stage
hours
parts
issues
notes
```

The original product principle explicitly requires the interface to work for people standing at a vehicle rather than only office users.

---

# 59. Reception UX

Reception should use a guided intake process:

```text
Customer
 ↓
Vehicle
 ↓
Insurance
 ↓
Damage
 ↓
Photos
 ↓
Estimate
 ↓
Authorization
 ↓
Repair Order
```

---

# 60. Progressive Enhancement

The application should remain functional on modest devices.

Avoid unnecessary:

```text
large animations
video backgrounds
heavy client libraries
large JavaScript bundles
```

Photographs should be compressed and lazy-loaded.

---

# 61. Accessibility

Target WCAG 2.2 AA principles.

Requirements include:

```text
keyboard navigation
focus visibility
semantic HTML
accessible labels
adequate contrast
screen-reader support
accessible dialogs
non-colour-only status indicators
```

---

# 62. File Upload Architecture

Uploads must be validated for:

```text
file type
file size
extension
MIME type
file signature
```

Recommended initial types:

```text
JPEG
PNG
WebP
PDF
```

Storage paths must be tenant-aware.

---

# 63. Storage Isolation

Example:

```text
organisation/{organisationId}/
    branch/{branchId}/
        repair-order/{repairOrderId}/
            photos/
            documents/
```

Storage access must also be protected by appropriate policies.

---

# 64. External Integration Architecture

External systems must use adapters.

```text
                 WorkShopOS
                     │
             Integration Interface
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    Audatex        CCC        Mitchell
     Adapter       Adapter     Adapter
```

The core application must not depend directly on one estimating provider.

The original PRD explicitly recommends an adapter pattern for these integrations.

---

# 65. Accounting Integration

Accounting should be treated as an integration boundary.

```text
WorkShopOS
     │
     ├── CSV Export
     │
     ├── Xero Adapter
     │
     └── Sage Adapter
```

WorkShopOS is not intended to become a full general ledger in the MVP.

---

# 66. Security Architecture

Security controls include:

```text
Supabase Auth
RLS
RBAC
server validation
secure sessions
HTTPS
secret management
file validation
rate limiting
audit logs
tenant isolation
least privilege
```

No frontend security check should be considered sufficient by itself.

---

# 67. Secrets Management

Never place secrets in:

```text
client code
Git
public environment variables
database records
logs
```

Use environment variables or deployment-platform secret storage.

---

# 68. Environment Separation

Maintain:

```text
development
staging
production
```

At minimum:

```text
development Supabase project
production Supabase project
```

Do not experiment against production.

---

# 69. Configuration

Application configuration should be centralised.

Examples:

```text
workflow configuration
file size limits
allowed MIME types
notification settings
pagination limits
feature flags
```

Do not scatter magic numbers throughout the application.

---

# 70. Feature Flags

Future functionality can be introduced behind feature flags.

Examples:

```text
offline_mode
whatsapp_notifications
accounting_export
supplier_integration
advanced_reporting
estimating_import
```

This allows gradual rollout.

---

# 71. Logging

Application logs should include:

```text
timestamp
severity
request ID
user ID where appropriate
organisation ID
operation
error code
```

Never log:

```text
passwords
tokens
API keys
payment secrets
sensitive customer data unnecessarily
```

---

# 72. Monitoring

MVP monitoring should cover:

```text
application errors
failed requests
database errors
authentication failures
storage failures
deployment failures
```

Advanced distributed tracing can be introduced later.

---

# 73. Testing Architecture

Testing occurs at four levels.

```text
Unit
 ↓
Integration
 ↓
Component
 ↓
End-to-End
```

Critical business rules must have unit tests.

Critical user journeys must have end-to-end tests.

---

# 74. Critical End-to-End Journey

The minimum end-to-end test should prove:

```text
Create customer
 ↓
Create vehicle
 ↓
Create RO
 ↓
Create estimate
 ↓
Assign technician
 ↓
Assign bay
 ↓
Move through workflow
 ↓
Order part
 ↓
Receive part
 ↓
Log labour
 ↓
Complete QC
 ↓
Generate invoice
 ↓
Customer sees status
```

---

# 75. CI/CD Architecture

Every pull request should execute:

```text
npm ci
 ↓
lint
 ↓
typecheck
 ↓
unit tests
 ↓
build
 ↓
E2E tests
```

Deployment should occur only after successful checks.

---

# 76. Git Strategy

Use:

```text
main
feature/*
fix/*
```

For a solo developer this is sufficient.

Every significant AI change should be committed separately.

---

# 77. AI Coding Architecture

AI is treated as an implementation assistant, not the system architect.

The project must contain:

```text
AGENTS.md
ARCHITECTURE.md
DATABASE.md
README.md
```

AI agents must read these before modifying code.

---

# 78. AI Coding Rules

AI agents must:

```text
follow ARCHITECTURE.md
follow DATABASE.md
follow AGENTS.md
reuse existing components
avoid unnecessary dependencies
write tests
preserve RLS
preserve tenant isolation
never expose secrets
never modify production
use migrations
run lint
run typecheck
run tests
```

AI agents must not:

```text
rewrite the entire project
delete migrations
disable RLS
remove tests to make builds pass
hard-code credentials
create duplicate architecture
replace libraries without justification
```

---

# 79. AI Task Granularity

AI coding tasks should be small.

Preferred:

```text
Implement Repair Order creation.
```

Not:

```text
Build WorkShopOS.
```

Each task should have:

```text
Goal
Context
Constraints
Files
Acceptance Criteria
Tests
```

---

# 80. Documentation Architecture

Maintain:

```text
README.md
ARCHITECTURE.md
DATABASE.md
AGENTS.md
API.md
SECURITY.md
DEPLOYMENT.md
```

Documentation should evolve with the application.

---

# 81. Deployment Architecture

Initial production:

```text
                  Internet
                     │
                     ▼
               CDN / HTTPS
                     │
                     ▼
               Next.js App
                     │
                     ▼
                 Supabase
             ┌───────┼───────┐
             ▼       ▼       ▼
          Postgres  Auth   Storage
```

The application remains stateless wherever possible.

---

# 82. Scalability

The architecture should scale through:

```text
database optimisation
indexing
pagination
caching
CDN
image optimisation
server-side rendering
background processing
connection management
```

Only introduce service extraction when measurable workload requires it.

---

# 83. Future Service Extraction

If scale eventually requires independent services:

```text
Next.js
   │
   ├── Repair Order Service
   ├── Notification Service
   ├── Document Service
   ├── Integration Service
   └── Analytics Service
```

The modular architecture makes this possible without requiring microservices from day one.

---

# 84. Disaster Recovery

Production must eventually include:

```text
database backups
storage backups
migration history
deployment rollback
recovery procedures
```

Recovery procedures must be documented before commercial launch.

---

# 85. Data Retention

Retention rules must be defined for:

```text
customer records
repair orders
photos
documents
audit logs
invoices
payments
customer portal tokens
```

Retention must account for business requirements and applicable South African privacy obligations.

---

# 86. POPIA Architecture Consideration

WorkShopOS processes personal information and must therefore incorporate privacy controls into the architecture.

Controls include:

```text
data minimisation
access control
auditability
secure storage
retention
consent where applicable
data access procedures
data deletion procedures
```

Legal compliance must be validated professionally before production launch.

---

# 87. Performance Architecture

Performance priorities:

### P0

```text
database queries
initial page load
dashboard
technician job list
repair order page
```

### P1

```text
image loading
reports
customer portal
```

### P2

```text
advanced analytics
large exports
historical reports
```

---

# 88. Lightweight Principle

Every new dependency requires justification.

Before adding a package, ask:

```text
Can native browser functionality solve this?

Can React solve this?

Can an existing dependency solve this?

Does this solve a real WorkShopOS requirement?

Will this increase maintenance cost?
```

If the answer is unclear:

> Do not install it.

---

# 89. Architecture Decision Records

Important architecture decisions should be recorded in:

```text
docs/adr/
```

Example:

```text
ADR-001-modular-monolith.md
ADR-002-supabase.md
ADR-003-postgresql.md
ADR-004-pwa.md
ADR-005-workflow-state-machine.md
```

This prevents AI agents from repeatedly reconsidering settled decisions.

---

# 90. Definition of Done

A WorkShopOS feature is complete only when:

```text
UI implemented
API/service implemented
validation implemented
authorization implemented
database migration created
RLS reviewed
loading state implemented
empty state implemented
error state implemented
mobile UI tested
unit tests added
integration tests added where necessary
audit requirements implemented
documentation updated
lint passes
typecheck passes
tests pass
production build passes
```

---

# 91. Engineering Golden Rules

### Rule 1

**The database is the source of truth.**

### Rule 2

**RLS is mandatory.**

### Rule 3

**Never trust the browser.**

### Rule 4

**Business logic belongs in services/domain logic.**

### Rule 5

**Never overwrite historical financial or workflow records.**

### Rule 6

**Every important operational action is auditable.**

### Rule 7

**Images belong in object storage, not PostgreSQL.**

### Rule 8

**AI writes code; tests determine whether the code works.**

### Rule 9

**Do not solve scale problems before they exist.**

### Rule 10

**Mobile workshop usability is a first-class requirement.**

---

# 92. Final Architecture

The resulting WorkShopOS architecture is:

```text
                         WORKSHOPOS
                             │
               ┌─────────────┴─────────────┐
               │                           │
          Web Browser                  PWA Mobile
               │                           │
               └─────────────┬─────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     Next.js     │
                    │   TypeScript    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   Presentation        Application           Authentication
      Layer               Layer                  / RBAC
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Domain Services │
                    ├─────────────────┤
                    │ Repair Orders   │
                    │ Workflow        │
                    │ Estimates       │
                    │ Parts           │
                    │ Labour          │
                    │ QC              │
                    │ Invoices        │
                    │ Notifications   │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              Data Access        Integrations
                    │                 │
                    ▼                 ▼
              PostgreSQL       External Systems
                    │
             ┌──────┼──────┐
             ▼      ▼      ▼
           RLS    Storage Realtime
                    │
                    ▼
             Photos/Documents
```

---

# 93. Architectural Outcome

This architecture provides WorkShopOS with:

- a lightweight MVP path
- clear separation of concerns
- multi-tenant isolation
- database-level security
- scalable workflow management
- mobile-first workshop operation
- controlled AI/vibe coding
- versioned database evolution
- testability
- auditable business operations
- future integration capability
- future multi-branch expansion
- future offline functionality
- future service extraction without an initial microservices burden

The next engineering document should be **`DATABASE.md`**, because the database schema, tenancy model, relationships, constraints, indexes, RLS strategy and audit model need to be locked down before an AI coding agent begins implementing the application.
