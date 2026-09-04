Document: API_CONTRACTS.md
System: WorkShopOS
Version: 1.0
Architecture: Modular Monolith / API-first
Frontend: Next.js + TypeScript
Backend: Next.js Route Handlers / Server Services
Database: PostgreSQL via Supabase
Authentication: Supabase Auth
Storage: Supabase Storage
API Style: REST + typed service layer
Primary Format: JSON

## Progress checklist

- [x] API objectives and standard error/success contracts are documented.
- [x] Login and logout routes use request validation and structured JSON responses.
- [x] Error-handling pattern is consistent with the documented contract.
- [ ] Versioned /api/v1 business routes for repair orders and workflows remain unimplemented.
- [x] Organisation/branch-scoped API enforcement is implemented at the server boundary for tenant-aware requests and proven by a minimal tenant-aware route.

Public routes such as `/api/auth/login`, `/api/auth/logout`, and health checks are intentionally tenant-agnostic and excluded from this guard. Any tenant-aware route or service entry point must call `resolveTenantContext` / `assertTenantMembership` or the shared `enforceTenantContract` helper before business logic executes.

- [ ] Workflow transition and state-machine action endpoints remain pending.
- [ ] Offline sync/idempotency and audit-event support remain pending.

1. Contract Objectives

The API layer must:

enforce authentication and RBAC;
enforce organisation and branch isolation;
validate every request server-side;
prevent clients from supplying trusted tenancy fields;
enforce repair workflow rules;
support offline synchronization;
provide idempotent mutation endpoints;
produce audit events for sensitive operations;
remain lightweight enough for a small workshop;
allow future extraction into separate services without rewriting the frontend.

The frontend must never communicate directly with PostgreSQL for business operations.

Browser
↓
API Route
↓
Authentication
↓
Authorization
↓
Validation
↓
Service Layer
↓
Repository/Data Access
↓
PostgreSQL 2. API Base URL

Production:

/api/v1

Development:

http://localhost:3000/api/v1

Example:

GET /api/v1/repair-orders 3. HTTP Standards
Operation HTTP
Retrieve GET
Create POST
Replace/update PUT
Partial update PATCH
Delete/archive DELETE
Action POST

Prefer explicit action endpoints for business operations.

Example:

POST /repair-orders/:id/transition

rather than:

PATCH /repair-orders/:id

with:

{
"status": "painting"
}

This prevents clients from bypassing workflow rules.

4. Standard Headers

Requests should support:

Authorization: Bearer <access_token>
Content-Type: application/json
X-Request-ID: <uuid>
X-Client-Version: 1.0.0
X-Client-Platform: web

Offline synchronization additionally:

X-Idempotency-Key: <uuid> 5. Authentication Contract

Authentication is handled through Supabase Auth.

The API receives the authenticated session.

The server derives:

user_id
organisation_id
branch memberships
roles
permissions

from trusted server-side sources.

The client must not be trusted to supply:

organisation_id
branch_id
role
permissions 6. Standard Success Response

Single resource:

{
"data": {
"id": "uuid",
"created_at": "2026-08-27T08:30:00Z"
}
}

Collection:

{
"data": [],
"meta": {
"page": 1,
"page_size": 25,
"total": 0
}
}

Mutation:

{
"data": {
"id": "uuid"
},
"message": "Repair order updated successfully"
} 7. Standard Error Contract

All API errors should use the same structure.

{
"error": {
"code": "FORBIDDEN",
"message": "You do not have permission to perform this action.",
"request_id": "uuid",
"details": {}
}
}

Recommended error codes:

VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
CONFLICT
DUPLICATE
INVALID_STATE
RATE_LIMITED
IDEMPOTENCY_CONFLICT
BUSINESS_RULE_VIOLATION
INTERNAL_ERROR

Never return database errors directly to the browser.

8. Pagination

Default:

page_size = 25
maximum = 100

Example:

GET /repair-orders?page=1&page_size=25

For large datasets, cursor pagination should eventually be supported:

GET /repair-orders?cursor=<token> 9. Filtering

Example:

GET /repair-orders?
status=in_progress
&branch_id=<uuid>
&assigned_to=<uuid>

However:

branch_id must not be used as a security mechanism.

The server determines whether the authenticated user can access that branch.

10. Sorting

Example:

GET /repair-orders?sort=-created_at

Allowed sort fields should be explicitly whitelisted.

Never interpolate arbitrary client-provided SQL fields.

11. Core Service Architecture

Recommended backend structure:

src/
├── app/
│ └── api/
│ └── v1/
│
├── modules/
│ ├── auth/
│ ├── organisations/
│ ├── branches/
│ ├── customers/
│ ├── vehicles/
│ ├── repair-orders/
│ ├── workflow/
│ ├── estimates/
│ ├── supplements/
│ ├── parts/
│ ├── labour/
│ ├── photos/
│ ├── documents/
│ ├── inspections/
│ ├── invoices/
│ ├── payments/
│ ├── notifications/
│ └── reports/
│
├── lib/
│ ├── auth/
│ ├── rbac/
│ ├── validation/
│ ├── database/
│ ├── audit/
│ ├── errors/
│ └── logging/
│
└── types/

Each module follows:

route
↓
controller
↓
service
↓
repository
↓
database 12. Customer API
Create Customer
POST /api/v1/customers

Permission:

customer.create

Request:

{
"first_name": "John",
"last_name": "Smith",
"phone": "+27821234567",
"email": "john@example.com",
"address": {
"line1": "Example Street",
"city": "Johannesburg",
"postal_code": "2000"
}
}

The server derives:

organisation_id
created_by
Get Customer
GET /api/v1/customers/:id

Permission:

customer.view

The service verifies:

organisation scope
branch scope
Update Customer
PATCH /api/v1/customers/:id

Permission:

customer.update 13. Vehicle API
Create Vehicle
POST /api/v1/vehicles

Permission:

vehicle.create

Request:

{
"customer_id": "uuid",
"registration": "ABC123GP",
"vin": "VIN",
"make": "Toyota",
"model": "Corolla",
"year": 2023,
"colour": "White",
"mileage": 45231
}

Server validates:

customer belongs to organisation
customer accessible to branch
registration format
VIN format 14. Repair Order API

The Repair Order is the primary operational object.

Create Repair Order
POST /api/v1/repair-orders

Permission:

repair_order.create

Request:

{
"customer_id": "uuid",
"vehicle_id": "uuid",
"repair_type": "collision",
"priority": "normal",
"insurance_claim": {
"claim_number": "CLM-12345",
"insurer_id": "uuid"
}
}

Server generates:

repair_order_id
ro_number
organisation_id
branch_id
created_by
status
timestamps

Example response:

{
"data": {
"id": "uuid",
"ro_number": "RO-2026-000123",
"status": "intake",
"vehicle_id": "uuid"
}
} 15. Repair Order Lifecycle

Recommended state machine:

draft
↓
intake
↓
assessment
↓
awaiting_authorisation
↓
authorised
↓
disassembly
↓
parts_ordering
↓
panel_beating
↓
paint_preparation
↓
painting
↓
assembly
↓
outwork
↓
final_inspection
↓
ready_for_collection
↓
collected
↓
closed

Additional terminal state:

cancelled 16. Transition API
POST /api/v1/repair-orders/:id/transition

Permission:

repair_order.transition

Request:

{
"to_status": "painting"
}

The service must determine:

current_status
required permissions
required prerequisites
outstanding parts
QC gates
authorisation

The client must not determine whether the transition is valid.

17. Workflow Transition Contract

Response:

{
"data": {
"repair_order_id": "uuid",
"from_status": "paint_preparation",
"to_status": "painting",
"transition_id": "uuid",
"transitioned_at": "2026-08-27T09:30:00Z"
}
}

Audit:

workflow.transition

must automatically be recorded.

18. Workflow Override
    POST /api/v1/repair-orders/:id/override-transition

Permission:

workflow.override

Request:

{
"to_status": "assembly",
"reason": "Customer-approved replacement part unavailable."
}

The API rejects:

{
"to_status": "assembly",
"reason": ""
}

with:

VALIDATION_ERROR

The override must create an immutable audit record.

19. Technician Assignment
    POST /api/v1/repair-orders/:id/assignments

Permission:

repair_order.assign

Request:

{
"technician_id": "uuid",
"role": "panel_beater"
}

Response:

{
"data": {
"assignment_id": "uuid",
"technician_id": "uuid",
"role": "panel_beater"
}
} 20. Bay Assignment
POST /api/v1/repair-orders/:id/bay

Permission:

bay.assign

Request:

{
"bay_id": "uuid"
}

The service must check:

bay exists
bay belongs to branch
bay is available
vehicle is not already occupying incompatible bay 21. Technician Job API

Technician mobile interface:

GET /api/v1/me/jobs

Permission:

repair_order.view_assigned

The endpoint should return only assigned jobs.

Example:

{
"data": [
{
"id": "uuid",
"ro_number": "RO-2026-000123",
"vehicle": {
"registration": "ABC123GP",
"make": "Toyota",
"model": "Corolla"
},
"current_stage": "panel_beating",
"priority": "normal"
}
]
} 22. Estimates API
Create Estimate
POST /api/v1/repair-orders/:id/estimates

Permission:

estimate.create

Request:

{
"items": [
{
"type": "labour",
"description": "Remove and refit front bumper",
"quantity": 1,
"unit_price": 1500
},
{
"type": "part",
"description": "Front bumper",
"quantity": 1,
"unit_price": 3500
}
]
}

The backend calculates:

subtotal
discount
tax
total

Do not trust totals supplied by the browser.

23. Estimate Versioning

Every meaningful estimate modification creates a version.

POST /api/v1/estimates/:id/versions

Example:

Estimate
├── v1
├── v2
└── v3 ← current

Previous versions become immutable.

24. Estimate Submission
    POST /api/v1/estimates/:id/submit

Permission:

estimate.submit

State:

draft
↓
submitted
↓
approved / rejected 25. Estimate Approval
POST /api/v1/estimates/:id/approve

Permission:

estimate.approve

The API must enforce:

approver != creator

where separation of duties is enabled.

26. Supplements API
    POST /api/v1/repair-orders/:id/supplements

Permission:

supplement.create

Submit:

POST /api/v1/supplements/:id/submit

Approve:

POST /api/v1/supplements/:id/approve

Reject:

POST /api/v1/supplements/:id/reject

Every supplement must retain:

original estimate
supplement number
reason
items
supporting photographs
documents
approval status
approval history 27. Parts API
Request Part
POST /api/v1/repair-orders/:id/parts

Permission:

part.request

Request:

{
"description": "Front bumper",
"part_number": "12345",
"quantity": 1,
"urgency": "normal"
} 28. Parts Lifecycle
requested
↓
ordered
↓
backordered
↓
received
↓
allocated
↓
fitted

Cancellation:

POST /api/v1/parts/:id/cancel

Return:

POST /api/v1/parts/:id/return 29. Receive Parts
POST /api/v1/parts/:id/receive

Permission:

part.receive

Request:

{
"quantity_received": 1,
"supplier_reference": "SUP-12345",
"received_at": "2026-08-27T10:00:00Z"
}

The operation must be transactional.

30. Labour API

Start timer:

POST /api/v1/repair-orders/:id/labour/start

Stop timer:

POST /api/v1/repair-orders/:id/labour/stop

Manual entry:

POST /api/v1/repair-orders/:id/labour

Request:

{
"technician_id": "uuid",
"stage": "panel_beating",
"minutes": 90,
"notes": "Repair left front panel."
}

Technicians can only create/modify their own time records unless explicitly authorised.

31. Photos API

Upload:

POST /api/v1/repair-orders/:id/photos

Recommended approach:

API
↓
request signed upload URL
↓
client uploads directly to Storage
↓
client confirms upload
↓
API records metadata

This avoids routing large images through the application server.

32. Photo Metadata
    {
    "category": "damage",
    "caption": "Left front quarter damage",
    "stage": "intake"
    }

Server generates:

organisation_id
branch_id
repair_order_id
uploaded_by
storage_path
created_at 33. Documents API
GET /documents
POST /documents
GET /documents/:id
DELETE /documents/:id
POST /documents/:id/share

Document visibility:

internal
customer
insurer
restricted
financial

The API must enforce visibility on every download.

34. Digital Signature API

Request:

POST /api/v1/signatures

Request:

{
"repair_order_id": "uuid",
"document_id": "uuid",
"signer_type": "customer"
}

Complete:

POST /api/v1/signatures/:id/complete

The server records:

signature_id
signer_id
document_hash
timestamp
IP metadata
user agent
signature status 35. Quality Control API

Create inspection:

POST /api/v1/repair-orders/:id/inspections

Checklist:

{
"bodywork": true,
"paint_match": true,
"panel_alignment": true,
"lights": true,
"interior": true,
"road_test": true
}

Complete:

POST /api/v1/inspections/:id/complete

Fail:

POST /api/v1/inspections/:id/fail

Failure requires:

{
"reason": "Paint mismatch on front fender.",
"severity": "major"
} 36. Ready-for-Collection Gate

The API should not permit:

final_inspection
↓
ready_for_collection

unless required gates are satisfied.

Example:

✓ QC passed
✓ required documents complete
✓ required signatures complete
✓ invoice issued
✓ payment/authorisation condition satisfied
✓ required photographs captured

These rules belong in the service layer/database transaction, not the UI.

37. Invoice API

Create:

POST /api/v1/repair-orders/:id/invoices

Issue:

POST /api/v1/invoices/:id/issue

Send:

POST /api/v1/invoices/:id/send

Void:

POST /api/v1/invoices/:id/void

Void requires:

{
"reason": "Incorrect customer details."
} 38. Payment API

Record payment:

POST /api/v1/invoices/:id/payments

Request:

{
"amount": 5000,
"method": "card",
"reference": "PAY-12345"
}

Refund:

POST /api/v1/payments/:id/refund

Refund requires:

{
"amount": 5000,
"reason": "Duplicate payment."
} 39. Notification API

Internal:

GET /api/v1/notifications

Mark read:

POST /api/v1/notifications/:id/read

The system should generate notifications from domain events rather than allowing the frontend to manually manufacture business notifications.

40. Domain Events

Recommended events:

repair_order.created
repair_order.assigned
repair_order.stage_changed
repair_order.overridden
estimate.created
estimate.submitted
estimate.approved
supplement.created
supplement.submitted
supplement.approved
part.requested
part.ordered
part.backordered
part.received
part.fitted
inspection.failed
inspection.passed
invoice.created
invoice.issued
payment.received
vehicle.ready
vehicle.collected 41. Event Processing

Example:

Technician completes painting
↓
POST /transition
↓
Workflow Service
↓
Database Transaction
↓
repair_order.stage_changed
↓
Event Handler
↙ ↓ ↘
Notification Audit Dashboard

This creates loose coupling.

42. Audit Service

Every sensitive service operation calls:

auditService.record({
actorId,
organisationId,
branchId,
action,
resource,
resourceId,
before,
after,
metadata
});

Example:

{
"action": "repair_order.override_transition",
"resource": "repair_order",
"resource_id": "uuid",
"metadata": {
"from": "painting",
"to": "assembly",
"reason": "Approved by workshop manager."
}
} 43. RBAC Service

Every protected service operation must be capable of:

await authorization.require(
user,
"repair_order.transition",
repairOrder
);

Conceptually:

authenticate()
↓
getMembership()
↓
getRoles()
↓
getPermissions()
↓
checkScope()
↓
allow / deny 44. Service Contract Example
interface RepairOrderService {
create(
actor: AuthenticatedUser,
input: CreateRepairOrderInput
): Promise<RepairOrder>;

getById(
actor: AuthenticatedUser,
id: string
): Promise<RepairOrder>;

update(
actor: AuthenticatedUser,
id: string,
input: UpdateRepairOrderInput
): Promise<RepairOrder>;

transition(
actor: AuthenticatedUser,
id: string,
input: TransitionRepairOrderInput
): Promise<RepairOrder>;

overrideTransition(
actor: AuthenticatedUser,
id: string,
input: OverrideTransitionInput
): Promise<RepairOrder>;
} 45. Repository Contract

The repository should never make authorization decisions.

Example:

interface RepairOrderRepository {
findById(id: string): Promise<RepairOrder | null>;

findMany(
filters: RepairOrderFilters
): Promise<RepairOrder[]>;

create(
data: CreateRepairOrderData
): Promise<RepairOrder>;

update(
id: string,
data: UpdateRepairOrderData
): Promise<RepairOrder>;
}

Authorization belongs above the repository.

Database RLS remains the final security boundary.

46. Validation

Use one shared schema definition for request validation.

For example:

const CreateRepairOrderSchema = z.object({
customer_id: z.string().uuid(),
vehicle_id: z.string().uuid(),
repair_type: z.enum([
"collision",
"mechanical",
"cosmetic"
]),
priority: z.enum([
"low",
"normal",
"high",
"urgent"
])
});

Never trust TypeScript types alone.

Runtime validation is mandatory.

47. Transaction Requirements

The following operations must be database transactions:

repair-order creation
workflow transition
workflow override
estimate approval
supplement approval
part receiving
invoice issuing
payment recording
payment reversal
vehicle collection

Example:

BEGIN

update repair_order

insert workflow_transition

insert audit_event

insert domain_event

COMMIT

If any step fails:

ROLLBACK 48. Idempotency

All important POST mutations should support idempotency.

Example:

POST /api/v1/payments
X-Idempotency-Key: 0e8f...

If the same request is submitted twice:

Request #1 → payment created
Request #2 → existing result returned

This is particularly important for:

mobile networks;
offline sync;
payment operations;
unreliable connections. 49. Offline Synchronisation API

Technicians require offline support.

Endpoint:

POST /api/v1/sync

Request:

{
"mutations": [
{
"mutation_id": "uuid",
"entity": "repair_order",
"entity_id": "uuid",
"operation": "transition",
"payload": {
"to_status": "painting"
},
"client_created_at": "2026-08-27T09:30:00Z"
}
]
} 50. Sync Response
{
"results": [
{
"mutation_id": "uuid",
"status": "applied",
"server_timestamp": "2026-08-27T09:35:00Z"
}
]
}

Possible statuses:

applied
already_applied
rejected
conflict
requires_retry 51. Offline Conflict Handling

Example:

Technician offline
↓
moves job → painting

Manager online
↓
moves job → awaiting_parts

Technician reconnects
↓
server detects conflict

The server must not blindly apply the technician's stale state.

Return:

{
"status": "conflict",
"reason": "RESOURCE_VERSION_CONFLICT"
}

The client then refreshes the current record.

52. Optimistic Concurrency

Important records should contain:

version
updated_at

Update request:

{
"version": 7,
"notes": "Updated damage assessment."
}

If database version is:

8

reject with:

CONFLICT

This prevents users overwriting each other's work.

53. API Rate Limiting

Rate-limit at minimum:

authentication
file uploads
exports
password/reset actions
customer messaging
payment endpoints
public portal endpoints

Example:

API:
100 requests/minute/user

Authentication:
10 requests/minute/IP

Exports:
5 requests/minute/user

Exact values can be tuned after deployment.

54. File Upload Security

Never trust:

filename
MIME type
extension
file size

Server validates:

file type
file signature
size
user permission
organisation
repair order access

Images should have size limits and preferably be compressed/resized before long-term storage.

55. API Security Rules

The vibe-coding agent must never implement:

❌ client-supplied organisation_id
❌ client-supplied branch ownership
❌ client-supplied permissions
❌ service-role key in browser
❌ direct database access from client
❌ unrestricted update endpoints
❌ unrestricted status fields
❌ arbitrary SQL filters
❌ frontend-only RBAC 56. API Endpoint Summary
/auth
/me

/organisations
/branches
/users
/roles
/permissions

/customers
/vehicles

/repair-orders
/repair-orders/:id
/repair-orders/:id/transition
/repair-orders/:id/override-transition
/repair-orders/:id/assignments
/repair-orders/:id/bay

/estimates
/estimates/:id/versions
/estimates/:id/submit
/estimates/:id/approve

/supplements
/supplements/:id/submit
/supplements/:id/approve
/supplements/:id/reject

/parts
/parts/:id/receive
/parts/:id/return

/labour
/photos
/documents
/signatures

/inspections
/inspections/:id/complete
/inspections/:id/fail

/invoices
/invoices/:id/issue
/invoices/:id/void

/payments
/payments/:id/refund

/notifications

/reports

/audit

/sync 57. API-to-RBAC Mapping
API Required Permission
POST /customers customer.create
PATCH /customers/:id customer.update
POST /vehicles vehicle.create
POST /repair-orders repair_order.create
PATCH /repair-orders/:id repair_order.update
POST /repair-orders/:id/transition repair_order.transition
POST /repair-orders/:id/override-transition workflow.override
POST /repair-orders/:id/assignments repair_order.assign
POST /estimates estimate.create
POST /estimates/:id/approve estimate.approve
POST /supplements supplement.create
POST /supplements/:id/approve supplement.approve
POST /parts part.request
POST /parts/:id/receive part.receive
POST /photos photo.upload
POST /inspections qc.create
POST /inspections/:id/complete qc.complete
POST /invoices invoice.create
POST /invoices/:id/issue invoice.issue
POST /payments payment.create
POST /payments/:id/refund payment.refund
GET /audit audit.view
POST /sync authenticated + resource permission 58. Frontend API Client

The frontend should use one API client.

api.get("/repair-orders");

api.post(
"/repair-orders",
payload
);

api.post(
`/repair-orders/${id}/transition`,
{
to_status: "painting"
}
);

Do not scatter raw fetch() calls throughout components.

Recommended:

src/lib/api/
├── client.ts
├── errors.ts
├── customers.ts
├── vehicles.ts
├── repair-orders.ts
├── estimates.ts
├── parts.ts
├── inspections.ts
├── invoices.ts
└── sync.ts 59. Typed API Client

For stronger vibe-coding reliability, generate or maintain shared types:

Frontend
↓
API Types
↓
Request Schema
↓
Server Validation
↓
Service

The frontend should never manually recreate backend response structures in multiple places.

60. Recommended Query Architecture

For dashboard/list data:

React component
↓
TanStack Query
↓
Typed API client
↓
API

Use caching for:

repair orders
customers
vehicles
parts
dashboard data

Use mutations for:

transition
assignment
estimate update
part receiving
QC
invoice
payment 61. Service Boundaries

For the MVP, do not build microservices.

Use a modular monolith:

Next.js
│
├── Customer Service
├── Vehicle Service
├── Repair Order Service
├── Workflow Service
├── Estimate Service
├── Parts Service
├── QC Service
├── Invoice Service
├── Payment Service
├── Notification Service
└── Audit Service
│
└── PostgreSQL

This keeps WorkShopOS lightweight and affordable.

If the product becomes large enough, these modules can later become independent services.

62. Service Dependency Rules

Avoid circular dependencies.

Recommended:

Customer
↓
Vehicle
↓
Repair Order
↓
Workflow
↓
QC
↓
Invoice
↓
Payment

Supporting services:

Audit
Notification
Storage
RBAC

should be reusable by all modules.

63. Business Rule Location

Rules belong in the backend.

Bad:

if (partsReceived) {
showNextButton();
}

Good:

Frontend:
show possible action

Backend:
determine whether action is permitted

The UI can guide the user, but the server decides.

64. Recommended MVP API Build Order

Build in this order:

1. Auth
2. Organisation/Branch
3. RBAC
4. Customers
5. Vehicles
6. Repair Orders
7. Workflow
8. Technician assignments
9. Photos
10. Parts
11. Estimates
12. Supplements
13. QC
14. Documents
15. Invoices
16. Payments
17. Notifications
18. Audit
19. Offline Sync
20. Reporting

This prevents the AI coding agent from attempting the entire system simultaneously.

65. Vibe-Coding Contract

When giving this specification to an AI coding agent, use this rule:

DO NOT IMPLEMENT ALL MODULES AT ONCE.

Implement one vertical slice at a time.

For every module:

1. Database migration
2. RLS policy
3. Permission definitions
4. Validation schemas
5. Repository
6. Service
7. API endpoint
8. Tests
9. Frontend API client
10. UI
11. RBAC UI protection
12. Audit events
13. Error handling
14. Responsive/mobile testing

Then move to the next module.

66. Definition of Done

An API feature is not complete until:

[ ] Authentication implemented
[ ] RBAC permission defined
[ ] RLS policy implemented
[ ] Tenant isolation tested
[ ] Branch isolation tested
[ ] Zod validation implemented
[ ] Service-layer business rules implemented
[ ] API endpoint implemented
[ ] Standard error response implemented
[ ] Audit logging implemented where required
[ ] Idempotency considered
[ ] Transaction implemented where required
[ ] Frontend API client implemented
[ ] Loading state implemented
[ ] Error state implemented
[ ] Mobile UI tested
[ ] Permission-denied state tested
[ ] Offline behaviour considered
[ ] Automated tests passing 67. Critical Architectural Principle

The final WorkShopOS request flow should always resemble:

                 ┌──────────────┐
                 │    Browser   │
                 └──────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │  API Route    │
                └──────┬────────┘
                       │
                       ▼
                ┌───────────────┐
                │ Authentication│
                └──────┬────────┘
                       │
                       ▼
                ┌───────────────┐
                │     RBAC      │
                └──────┬────────┘
                       │
                       ▼
                ┌───────────────┐
                │   Validation  │
                └──────┬────────┘
                       │
                       ▼
                ┌───────────────┐
                │ Business      │
                │ Service       │
                └──────┬────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
       ┌────────────┐    ┌─────────────┐
       │ Repository │    │ Audit/Event │
       └─────┬──────┘    └─────────────┘
             │
             ▼
       ┌────────────┐
       │ PostgreSQL │
       │    + RLS   │
       └────────────┘

This should be treated as the canonical API architecture for WorkShopOS.

The important design decision is to keep the MVP as a modular monolith rather than microservices. That gives you the scalability and separation of concerns you need without introducing unnecessary infrastructure, Docker/Kubernetes complexity, queues, service discovery, or cloud costs while you are vibe-coding the first production version.
