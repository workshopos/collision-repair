# WorkShopOS — Complete RBAC & Permission Matrix

**Document:** RBAC.md
**System:** WorkShopOS
**Version:** 1.0
**Security Model:** Multi-tenant + Branch-aware + Permission-based RBAC
**Database:** PostgreSQL / Supabase
**Authentication:** Supabase Auth

---

# 1. RBAC OBJECTIVE

WorkShopOS uses a **Role-Based Access Control (RBAC)** model backed by granular permissions.

The system must not rely on frontend role checks alone.

The security hierarchy is:

```text
User
  ↓
Organisation Membership
  ↓
Branch Membership
  ↓
Role
  ↓
Permissions
  ↓
Resource Scope
  ↓
Database RLS
```

Every permission must ultimately be enforced by the backend/database.

Frontend permission checks are only used to improve the user experience.

---

# 2. SECURITY SCOPES

Every permission operates within one or more scopes.

| Scope          | Description                                    |
| -------------- | ---------------------------------------------- |
| `own`          | Records created/owned by the user              |
| `assigned`     | Records specifically assigned to the user      |
| `branch`       | All records belonging to the user's branch     |
| `organisation` | All records within the organisation            |
| `group`        | Multiple branches within an organisation/group |
| `global`       | System-wide administrative access              |

Example:

```text
technician
  repair_order.view
  scope = assigned
```

while:

```text
workshop_manager
  repair_order.view
  scope = branch
```

---

# 3. STANDARD SYSTEM ROLES

WorkShopOS should ship with these default roles.

| Role                        | Code                | Primary Scope   |
| --------------------------- | ------------------- | --------------- |
| System Administrator        | `system_admin`      | Global          |
| Group Administrator         | `group_admin`       | Organisation    |
| Regional Manager            | `regional_manager`  | Group           |
| Branch Manager              | `branch_manager`    | Branch          |
| Workshop Manager / Foreman  | `workshop_manager`  | Branch          |
| Reception / Service Advisor | `service_advisor`   | Branch          |
| Estimator                   | `estimator`         | Branch          |
| Technician                  | `technician`        | Assigned        |
| Parts Controller            | `parts_controller`  | Branch          |
| Quality Inspector           | `quality_inspector` | Branch          |
| Accounts / Finance          | `finance`           | Branch          |
| Read-Only Manager           | `manager_viewer`    | Branch          |
| Insurer / Assessor          | `insurer`           | Assigned claims |
| Customer                    | `customer`          | Own records     |

---

# 4. PERMISSION NAMING STANDARD

Permissions use:

```text
resource.action
```

Examples:

```text
repair_order.view
repair_order.create
repair_order.update
repair_order.assign
repair_order.transition
```

Sensitive operations receive their own permission.

For example:

```text
invoice.create
invoice.issue
invoice.void
payment.create
payment.refund
```

This prevents broad permissions from accidentally granting financial authority.

---

# 5. CUSTOMER MANAGEMENT

## Permissions

```text
customer.view
customer.create
customer.update
customer.archive
customer.delete
customer.export
customer.view_sensitive
```

| Permission                | Description                         |
| ------------------------- | ----------------------------------- |
| `customer.view`           | View customer records               |
| `customer.create`         | Create customers                    |
| `customer.update`         | Edit customer details               |
| `customer.archive`        | Archive customer                    |
| `customer.delete`         | Permanently delete customer         |
| `customer.export`         | Export customer data                |
| `customer.view_sensitive` | View sensitive customer information |

### Default role access

| Role             |     View | Create |  Update | Archive | Delete | Export | Sensitive |
| ---------------- | -------: | -----: | ------: | ------: | -----: | -----: | --------: |
| System Admin     |        ✓ |      ✓ |       ✓ |       ✓ |      ✓ |      ✓ |         ✓ |
| Group Admin      |        ✓ |      ✓ |       ✓ |       ✓ |      — |      ✓ |         ✓ |
| Regional Manager |        ✓ |      ✓ |       ✓ |       ✓ |      — |      ✓ |         ✓ |
| Branch Manager   |        ✓ |      ✓ |       ✓ |       ✓ |      — |      ✓ |         ✓ |
| Workshop Manager |        ✓ |      ✓ |       ✓ |       ✓ |      — |      — |         ✓ |
| Service Advisor  |        ✓ |      ✓ |       ✓ |       ✓ |      — |      — |         ✓ |
| Estimator        |        ✓ |      — |       ✓ |       — |      — |      — |   Limited |
| Technician       | Assigned |      — | Limited |       — |      — |      — |         — |
| Parts Controller |        ✓ |      — | Limited |       — |      — |      — |         — |
| Inspector        |        ✓ |      — | Limited |       — |      — |      — |         — |
| Finance          |        ✓ |      — | Limited |       — |      — |      ✓ |         ✓ |
| Insurer          | Assigned |      — |       — |       — |      — |      — |   Limited |
| Customer         |      Own |      — | Limited |       — |      — |      — |       Own |

---

# 6. VEHICLE MANAGEMENT

```text
vehicle.view
vehicle.create
vehicle.update
vehicle.archive
vehicle.delete
vehicle.export
vehicle.view_sensitive
```

Technicians normally receive:

```text
vehicle.view
```

for vehicles associated with their assigned repair orders.

They should not have unrestricted access to the entire customer/vehicle database.

---

# 7. REPAIR ORDER MANAGEMENT

The Repair Order is the central operational entity.

```text
repair_order.view
repair_order.create
repair_order.update
repair_order.assign
repair_order.unassign
repair_order.transition
repair_order.override_transition
repair_order.cancel
repair_order.reopen
repair_order.close
repair_order.archive
repair_order.export
repair_order.view_financials
repair_order.view_internal_notes
```

| Permission            | Purpose                        |
| --------------------- | ------------------------------ |
| `view`                | View RO                        |
| `create`              | Create RO                      |
| `update`              | Edit RO                        |
| `assign`              | Assign technician/bay          |
| `unassign`            | Remove assignment              |
| `transition`          | Move workflow stage            |
| `override_transition` | Override workflow gate         |
| `cancel`              | Cancel repair                  |
| `reopen`              | Reopen closed/cancelled repair |
| `close`               | Close repair                   |
| `archive`             | Archive historical RO          |
| `export`              | Export RO                      |
| `view_financials`     | View costing/margin            |
| `view_internal_notes` | View internal workshop notes   |

---

# 8. REPAIR ORDER ROLE MATRIX

| Permission     | Admin | Branch Mgr | Workshop Mgr | Advisor | Estimator | Technician |         Parts | Inspector | Finance |  Insurer | Customer |
| -------------- | ----: | ---------: | -----------: | ------: | --------: | ---------: | ------------: | --------: | ------: | -------: | -------: |
| View           |     ✓ |          ✓ |            ✓ |       ✓ |         ✓ |   Assigned |             ✓ |         ✓ |       ✓ | Assigned |      Own |
| Create         |     ✓ |          ✓ |            ✓ |       ✓ |         ✓ |          — |             — |         — |       — |        — |        — |
| Update         |     ✓ |          ✓ |            ✓ |       ✓ |         ✓ |    Limited |         Parts |        QC | Finance |        — |        — |
| Assign         |     ✓ |          ✓ |            ✓ |       — |         — |          — |             — |         — |       — |        — |        — |
| Transition     |     ✓ |          ✓ |            ✓ | Limited |   Limited |          ✓ | Parts-related |        QC |       — |        — |        — |
| Override       |     ✓ |          ✓ |            ✓ |       — |         — |          — |             — |         — |       — |        — |        — |
| Cancel         |     ✓ |          ✓ |            ✓ |       ✓ |         ✓ |          — |             — |         — |       — |        — |        — |
| Reopen         |     ✓ |          ✓ |            ✓ |       — |         ✓ |          — |             — |         — |       — |        — |        — |
| Close          |     ✓ |          ✓ |            ✓ |       — |         — |          — |             — |         ✓ |       ✓ |        — |        — |
| Financials     |     ✓ |          ✓ |            ✓ | Limited |         ✓ |          — |       Limited |         — |       ✓ |        — |      Own |
| Internal Notes |     ✓ |          ✓ |            ✓ |       ✓ |         ✓ |   Assigned |             ✓ |         ✓ | Limited |        — |        — |

---

# 9. WORKFLOW MANAGEMENT

The PRD defines eight operational stages:

1. Disassembly
2. Parts Ordering
3. Panel Beating
4. Paint Preparation
5. Painting
6. Assembly
7. Outwork/Polishing
8. Final Inspection

Permissions:

```text
workflow.view
workflow.transition
workflow.override
workflow.assign
workflow.configure
workflow.manage_sla
```

### Rules

Technicians:

```text
workflow.view
workflow.transition
```

Managers:

```text
workflow.view
workflow.transition
workflow.override
workflow.assign
workflow.manage_sla
```

Only system/group administrators should have:

```text
workflow.configure
```

---

# 10. STAGE-SPECIFIC TECHNICIAN PERMISSIONS

Technicians should not automatically receive unrestricted workflow control.

Example:

```text
Panel Technician
  panel_beating.view
  panel_beating.update
  panel_beating.complete
```

```text
Painter
  paint_prep.view
  paint_prep.update
  paint.view
  paint.complete
```

```text
Assembler
  assembly.view
  assembly.update
  assembly.complete
```

```text
Polisher
  outwork.view
  outwork.update
  outwork.complete
```

This allows WorkShopOS to support specialist teams later without redesigning RBAC.

---

# 11. ESTIMATING

```text
estimate.view
estimate.create
estimate.update
estimate.submit
estimate.approve
estimate.reject
estimate.version
estimate.import
estimate.export
estimate.delete
```

| Role            |     View | Create |        Edit |     Submit | Approve | Import | Export |
| --------------- | -------: | -----: | ----------: | ---------: | ------: | -----: | -----: |
| Admin           |        ✓ |      ✓ |           ✓ |          ✓ |       ✓ |      ✓ |      ✓ |
| Branch Manager  |        ✓ |      ✓ |           ✓ |          ✓ |       ✓ |      ✓ |      ✓ |
| Estimator       |        ✓ |      ✓ |           ✓ |          ✓ |       — |      ✓ |      ✓ |
| Service Advisor |        ✓ |      ✓ |           ✓ |          — |       — |      — |      — |
| Technician      | Assigned |      — | Parts notes |          — |       — |      — |      — |
| Finance         |        ✓ |      — |           — |          — |       — |      — |      ✓ |
| Insurer         | Assigned |      — |           — | ✓/Response |       ✓ |      — |      ✓ |
| Customer        |      Own |      — |           — |          — |       — |      — |    Own |

---

# 12. ESTIMATE APPROVAL

Approval must be separate from editing.

A user who can:

```text
estimate.update
```

must not automatically receive:

```text
estimate.approve
```

This creates separation of duties.

---

# 13. SUPPLEMENTS

```text
supplement.view
supplement.create
supplement.update
supplement.submit
supplement.approve
supplement.reject
supplement.override
```

| Role             |     View | Create |    Edit | Submit | Approve | Reject |
| ---------------- | -------: | -----: | ------: | -----: | ------: | -----: |
| Admin            |        ✓ |      ✓ |       ✓ |      ✓ |       ✓ |      ✓ |
| Branch Manager   |        ✓ |      ✓ |       ✓ |      ✓ |       ✓ |      ✓ |
| Estimator        |        ✓ |      ✓ |       ✓ |      ✓ |       — |      — |
| Workshop Manager |        ✓ |      ✓ | Limited |      — |       — |      — |
| Technician       | Assigned |   Flag |       — |      — |       — |      — |
| Insurer          | Assigned |      — |       — |      — |       ✓ |      ✓ |
| Customer         |      Own |      — |       — |      — |       — |      — |

---

# 14. PARTS MANAGEMENT

The PRD requires:

```text
Not Ordered
→ Ordered
→ Backordered
→ Received
→ Fitted
```

Permissions:

```text
part.view
part.create
part.update
part.request
part.order
part.cancel_order
part.receive
part.return
part.fit
part.manage_supplier
part.view_cost
part.export
```

| Role             |     View | Request | Order | Receive | Fit | Supplier | Cost |
| ---------------- | -------: | ------: | ----: | ------: | --: | -------: | ---: |
| Admin            |        ✓ |       ✓ |     ✓ |       ✓ |   ✓ |        ✓ |    ✓ |
| Branch Manager   |        ✓ |       ✓ |     ✓ |       ✓ |   ✓ |        ✓ |    ✓ |
| Workshop Manager |        ✓ |       ✓ |     ✓ |       ✓ |   ✓ |        ✓ |    ✓ |
| Estimator        |        ✓ |       ✓ |     — |       — |   — |        — |    ✓ |
| Technician       | Assigned |       ✓ |     — |       — |   ✓ |        — |    — |
| Parts Controller |        ✓ |       ✓ |     ✓ |       ✓ |   ✓ |        ✓ |    ✓ |
| Finance          |        ✓ |       — |     — |       — |   — |        — |    ✓ |
| Inspector        |        ✓ |       — |     — |       — |   — |        — |    — |

---

# 15. INVENTORY

Phase 2/3 capable permissions:

```text
inventory.view
inventory.create
inventory.update
inventory.adjust
inventory.receive
inventory.transfer
inventory.writeoff
inventory.audit
```

Inventory adjustments should require elevated permission.

---

# 16. LABOUR / TIME TRACKING

```text
labour.view
labour.create
labour.update
labour.approve
labour.delete
labour.view_cost
labour.export
```

### Technician

```text
labour.view
labour.create
labour.update_own
```

### Workshop Manager

```text
labour.view
labour.create
labour.update
labour.approve
```

### Finance

```text
labour.view
labour.view_cost
labour.export
```

Technicians should not automatically see internal labour cost or profit margins.

---

# 17. PHOTO MANAGEMENT

The PRD requires photos at intake, workflow transitions and final QC.

Permissions:

```text
photo.view
photo.upload
photo.update_metadata
photo.delete
photo.download
photo.export
```

| Role       |         View | Upload |  Delete | Download |
| ---------- | -----------: | -----: | ------: | -------: |
| Admin      |            ✓ |      ✓ |       ✓ |        ✓ |
| Manager    |            ✓ |      ✓ |       ✓ |        ✓ |
| Advisor    |            ✓ |      ✓ | Limited |        ✓ |
| Estimator  |            ✓ |      ✓ | Limited |        ✓ |
| Technician |     Assigned |      ✓ |     Own |        ✓ |
| Inspector  |            ✓ |      ✓ | Limited |        ✓ |
| Customer   | Own approved |      — |       — | Approved |
| Insurer    |        Claim |      — |       — | Approved |

Customer/insurer users must never automatically receive access to internal workshop photographs.

---

# 18. DOCUMENT MANAGEMENT

```text
document.view
document.upload
document.update
document.download
document.delete
document.share
document.approve
document.export
```

Sensitive documents should support classifications:

```text
public
customer_visible
insurer_visible
internal
restricted
financial
```

---

# 19. DIGITAL SIGNATURES

```text
signature.request
signature.view
signature.sign
signature.cancel
signature.verify
```

Customer:

```text
signature.sign
signature.view
```

Workshop staff:

```text
signature.request
signature.view
signature.verify
```

No employee should be able to impersonate a customer's signature.

---

# 20. QUALITY CONTROL

```text
qc.view
qc.create
qc.update
qc.complete
qc.fail
qc.reopen
qc.approve_handover
qc.test_drive
```

### Quality Inspector

```text
qc.view
qc.create
qc.update
qc.complete
qc.fail
qc.approve_handover
qc.test_drive
```

### Workshop Manager

```text
qc.view
qc.create
qc.update
qc.reopen
```

Only authorised inspectors/managers should be able to complete final QC.

The PRD specifically requires final QC, test-drive sign-off, photographs and handover signature.

---

# 21. INVOICING

```text
invoice.view
invoice.create
invoice.update
invoice.issue
invoice.send
invoice.void
invoice.export
invoice.view_cost
invoice.view_margin
```

Critical separation:

```text
invoice.update
```

does NOT imply:

```text
invoice.issue
```

and:

```text
invoice.issue
```

does NOT imply:

```text
invoice.void
```

---

# 22. PAYMENT MANAGEMENT

```text
payment.view
payment.create
payment.allocate
payment.reverse
payment.refund
payment.export
```

Payments should be protected more heavily than normal operational records.

Technicians:

```text
NO ACCESS
```

Service Advisors:

```text
view limited
```

Finance:

```text
FULL
```

Managers:

```text
view
```

Refunds require elevated authority.

---

# 23. CUSTOMER PORTAL

The customer portal should use a restricted permission namespace:

```text
portal.view
portal.view_vehicle
portal.view_progress
portal.view_photos
portal.view_documents
portal.view_estimate
portal.approve_estimate
portal.sign_authorisation
portal.sign_handover
portal.view_invoice
portal.make_payment
```

Customer scope:

```text
OWN CUSTOMER
```

A customer must never be able to manipulate:

```text
organisation_id
branch_id
repair_order_id
customer_id
```

to access another customer's data.

---

# 24. INSURER / ASSESSOR PORTAL

Permissions:

```text
insurer.view_claim
insurer.view_estimate
insurer.view_supplement
insurer.approve_supplement
insurer.reject_supplement
insurer.view_photos
insurer.download_documents
insurer.comment
```

The insurer should only see claims explicitly assigned to them.

They should not see:

```text
internal notes
technician salaries
supplier costs
profit margins
other customer records
other claims
internal audit logs
```

---

# 25. DASHBOARD PERMISSIONS

```text
dashboard.view
dashboard.view_operations
dashboard.view_financials
dashboard.view_kpis
dashboard.view_branch
dashboard.view_group
dashboard.export
```

| Role             | Operations |   Financial |  Branch | Group |
| ---------------- | ---------: | ----------: | ------: | ----: |
| Admin            |          ✓ |           ✓ |       ✓ |     ✓ |
| Group Admin      |          ✓ |           ✓ |       ✓ |     ✓ |
| Regional Manager |          ✓ |           ✓ |       ✓ |     ✓ |
| Branch Manager   |          ✓ |           ✓ |       ✓ |     — |
| Workshop Manager |          ✓ |     Limited |       ✓ |     — |
| Advisor          |    Limited |           — | Limited |     — |
| Estimator        |    Limited |    Estimate |       — |     — |
| Technician       |        Own |           — |       — |     — |
| Parts Controller |      Parts |           — |   Parts |     — |
| Inspector        |         QC |           — |      QC |     — |
| Finance          |  Financial |           ✓ |       ✓ |     ✓ |
| Insurer          |      Claim |           — |       — |     — |
| Customer         |        Own | Own invoice |       — |     — |

---

# 26. REPORTING

```text
report.view
report.create
report.export
report.schedule
report.view_financial
report.view_staff
report.view_customer
report.view_branch
report.view_group
```

Financial and employee reports should require elevated permissions.

---

# 27. AUDIT LOGS

```text
audit.view
audit.export
audit.configure
```

Normal users:

```text
NO INSERT
NO UPDATE
NO DELETE
```

Audit entries must be generated automatically.

Audit records should capture:

```text
user_id
organisation_id
branch_id
action
resource
resource_id
old_values
new_values
ip_address
user_agent
timestamp
```

The PRD explicitly requires stage changes, estimate edits and document uploads to be attributed and timestamped.

---

# 28. USER MANAGEMENT

```text
user.view
user.invite
user.update
user.disable
user.delete
user.reset_access
user.assign_role
user.remove_role
user.assign_branch
```

Only administrators should manage roles.

A normal manager must not be able to promote themselves to:

```text
group_admin
system_admin
```

---

# 29. ROLE MANAGEMENT

```text
role.view
role.create
role.update
role.delete
role.assign_permissions
```

Default system roles should be protected.

Recommended rule:

```text
System roles → cannot be deleted
Custom roles → can be created
Custom roles → can be modified
```

---

# 30. ORGANISATION MANAGEMENT

```text
organisation.view
organisation.update
organisation.configure
organisation.billing
organisation.delete
```

Only:

```text
system_admin
group_admin
```

should receive organisation-management permissions.

---

# 31. BRANCH MANAGEMENT

```text
branch.view
branch.create
branch.update
branch.archive
branch.configure
branch.assign_users
```

Branch managers receive:

```text
branch.view
branch.update
branch.assign_users
```

They should not receive:

```text
organisation.delete
```

or group-level administration.

---

# 32. BAY / WORKSHOP RESOURCE MANAGEMENT

```text
bay.view
bay.create
bay.update
bay.assign
bay.block
bay.configure
```

Workshop managers:

```text
bay.view
bay.assign
bay.block
```

Administrators:

```text
FULL
```

Technicians:

```text
view assigned bay
```

---

# 33. NOTIFICATIONS

```text
notification.view
notification.send
notification.configure
notification.broadcast
```

Automated notifications should be system-generated.

The PRD identifies automated milestone notifications including RO creation, parts delays, painting and ready-for-collection.

---

# 34. CUSTOMER COMMUNICATION

```text
communication.view
communication.send
communication.template_manage
communication.history
```

Service Advisors and Managers receive:

```text
communication.view
communication.send
communication.history
```

Technicians:

```text
communication.view
```

but normally should not send customer-facing messages without permission.

---

# 35. INTEGRATIONS

```text
integration.view
integration.configure
integration.enable
integration.disable
integration.test
integration.sync
integration.import
integration.export
```

Only administrators should configure external integrations.

Future integrations include:

```text
Audatex
CCC Collision
Mitchell
Xero
Sage
Supplier APIs
```

The PRD specifically recommends an adapter-based architecture for estimating integrations.

---

# 36. DATA EXPORT

```text
data.export
data.export_customer
data.export_repair_orders
data.export_financial
data.export_reports
```

Exports should be audited.

Example:

```text
User
 ↓
Export Request
 ↓
Permission Check
 ↓
Scope Check
 ↓
Generate Export
 ↓
Audit Log
```

---

# 37. DATA IMPORT

```text
data.import
estimate.import
customer.import
vehicle.import
parts.import
```

Imported data should pass validation before being committed.

Never allow imported files to bypass:

```text
RLS
validation
business rules
audit logging
```

---

# 38. SYSTEM ADMINISTRATOR

`system_admin`

Full system authority.

```text
ALL PERMISSIONS
```

However, even system administrators should have sensitive actions audited.

---

# 39. GROUP ADMINISTRATOR

`group_admin`

Primary permissions:

```text
organisation.*
branch.*
user.*
role.*
dashboard.*
report.*
repair_order.view
estimate.view
invoice.view
financial reporting
audit.view
```

Cannot bypass system-level security controls.

---

# 40. REGIONAL MANAGER

`regional_manager`

Scope:

```text
assigned branches
```

Can:

```text
view branches
view repair orders
view KPIs
view financial performance
compare branches
view staff utilisation
view cycle time
```

Cannot modify system-wide configuration.

---

# 41. BRANCH MANAGER

`branch_manager`

Full branch operational authority:

```text
customers
vehicles
repair orders
workflow
technicians
parts
estimates
supplements
QC
invoices
branch reports
```

Financial actions should remain separated where possible.

---

# 42. WORKSHOP MANAGER / FOREMAN

`workshop_manager`

Primary purpose:

```text
workshop operations
```

Can:

```text
assign technicians
assign bays
move vehicles
override workflow gates
monitor SLA
manage bottlenecks
view parts status
view technician hours
review QC
```

Should not automatically receive:

```text
payment.refund
organisation.delete
role.assign_permissions
```

---

# 43. SERVICE ADVISOR / RECEPTION

`service_advisor`

Optimised for front-desk operations.

Can:

```text
create customers
create vehicles
create repair orders
capture intake
capture photos
capture signatures
communicate with customers
view repair progress
create basic estimates
```

Should not:

```text
approve supplements
change accounting records
modify audit logs
change system configuration
```

---

# 44. ESTIMATOR

`estimator`

Can:

```text
create estimates
edit estimates
create supplements
submit supplements
manage estimate versions
capture damage information
view insurer information
```

Cannot normally:

```text
approve own estimate
approve own supplement
modify payments
modify invoices
```

This provides separation of duties.

---

# 45. TECHNICIAN

`technician`

Designed for mobile/PWA use.

The PRD specifically calls for technicians to see their jobs, update stages, log hours, attach photos and flag parts/issues.

Permissions:

```text
repair_order.view_assigned
workflow.view_assigned
workflow.transition_assigned
labour.create_own
labour.update_own
photo.upload
parts.request
issue.create
notification.view
vehicle.view_assigned
```

Technicians should not receive:

```text
customer.export
invoice.*
payment.*
audit.*
user.*
role.*
financial_margin
```

---

# 46. PARTS CONTROLLER

`parts_controller`

Can:

```text
view parts
create part requests
order parts
track suppliers
receive parts
mark backorders
mark fitted
view lead times
```

Can receive notifications when technicians flag parts.

This directly supports the PRD requirement that parts requests trigger timely action.

---

# 47. QUALITY INSPECTOR

`quality_inspector`

Can:

```text
view assigned vehicles
perform inspections
complete QC checklist
capture photos
record defects
fail QC
pass QC
test drive
sign off handover
```

Cannot:

```text
edit financial records
approve estimates
manage users
modify audit logs
```

---

# 48. FINANCE / ACCOUNTS

`finance`

Can:

```text
view invoices
create invoices
issue invoices
record payments
allocate payments
reconcile payments
view costs
view margins
export financial reports
```

High-risk actions:

```text
invoice.void
payment.reverse
payment.refund
```

should require elevated finance permission.

---

# 49. READ-ONLY MANAGER

`manager_viewer`

Useful for owners, directors and auditors.

Can:

```text
dashboard.view
repair_order.view
estimate.view
parts.view
invoice.view
report.view
```

Cannot modify operational data.

---

# 50. INSURER / ASSESSOR

`insurer`

Scope:

```text
assigned_claims_only
```

Can:

```text
view claim
view estimate
view supplement
review photographs
approve/reject supplement
comment
download approved documents
```

Cannot access internal workshop operations outside their assigned claims.

---

# 51. CUSTOMER

`customer`

Scope:

```text
own_customer_records
```

Can:

```text
view repair status
view approved photos
view approved documents
view estimate
approve estimate
sign authorisation
view invoice
make payment
sign handover
```

Cannot:

```text
edit repair workflow
view internal notes
view supplier information
view technician information
view profit margin
view internal costs
```

---

# 52. DEFAULT DENY

The most important RBAC rule:

```text
NO PERMISSION = NO ACCESS
```

Never implement:

```typescript
if (!permission) {
    allow();
}
```

Instead:

```typescript
if (!permission) {
    deny();
}
```

Database RLS must enforce the same principle.

---

# 53. SEPARATION OF DUTIES

Certain permissions must never automatically imply others.

Examples:

```text
estimate.update
        ≠
estimate.approve
```

```text
invoice.create
        ≠
invoice.issue
```

```text
payment.create
        ≠
payment.refund
```

```text
user.update
        ≠
user.assign_role
```

```text
workflow.transition
        ≠
workflow.override
```

---

# 54. SELF-APPROVAL PREVENTION

The system should prevent users from approving their own sensitive transactions where separation of duties applies.

Examples:

```text
Estimator creates supplement
        ↓
Estimator cannot approve supplement
        ↓
Manager/authorised approver approves
```

Likewise:

```text
Invoice creator
        ↓
cannot approve sensitive financial adjustment
```

---

# 55. TEMPORARY PERMISSIONS

Future implementation should support temporary permissions.

Example:

```text
User: John
Permission: parts.order
Valid:
2026-09-01 → 2026-09-14
```

Useful for:

```text
leave cover
temporary managers
contractors
training
branch transfers
```

---

# 56. CUSTOM ROLES

Administrators should be able to create custom roles.

Example:

```text
Senior Panel Technician
```

Permissions:

```text
repair_order.view_assigned
workflow.transition_assigned
labour.create_own
photo.upload
parts.request
```

Another:

```text
Senior Estimator
```

Permissions:

```text
estimate.*
supplement.*
repair_order.view
document.*
```

---

# 57. MULTIPLE ROLES

Users may hold multiple roles.

Example:

```text
Jane
├── Estimator
└── Branch Manager
```

Effective permissions:

```text
UNION(
    estimator_permissions,
    branch_manager_permissions
)
```

However, scope restrictions must still apply.

---

# 58. ROLE PRIORITY

Do not implement role priority as:

```text
admin > manager > technician
```

Instead use explicit permissions.

A custom role may legitimately have:

```text
estimate.approve
```

without being a manager.

---

# 59. PERMISSION DATABASE MODEL

Recommended tables:

```text
roles
permissions
role_permissions
user_roles
user_permissions
organisation_memberships
branch_memberships
```

Recommended schema:

```text
roles
-----
id
organisation_id nullable
name
slug
description
is_system_role
created_at
updated_at
```

```text
permissions
-----------
id
key
resource
action
description
```

```text
role_permissions
-----------------
role_id
permission_id
```

```text
user_roles
----------
user_id
role_id
organisation_id
branch_id nullable
```

---

# 60. EXPLICIT USER PERMISSIONS

Future enterprise support may allow:

```text
user_permissions
```

Example:

```text
User
Role:
Technician

Additional permission:
workflow.override

Expires:
2026-09-30
```

This should be exceptional rather than the normal access model.

---

# 61. RLS INTEGRATION

RBAC must integrate with PostgreSQL RLS.

Conceptually:

```text
SELECT repair_order
WHERE
    organisation_id = user's organisation
AND
    user's role permits repair_order.view
AND
    user's branch scope permits access
```

RLS remains the final enforcement layer.

---

# 62. FRONTEND ROUTE PROTECTION

Example:

```text
/dashboard
```

requires:

```text
dashboard.view
```

```text
/repair-orders
```

requires:

```text
repair_order.view
```

```text
/estimates
```

requires:

```text
estimate.view
```

```text
/invoices
```

requires:

```text
invoice.view
```

---

# 63. UI COMPONENT PROTECTION

Buttons should be permission-aware.

Example:

```text
[Edit Estimate]
```

requires:

```text
estimate.update
```

```text
[Approve Supplement]
```

requires:

```text
supplement.approve
```

```text
[Void Invoice]
```

requires:

```text
invoice.void
```

But hiding the button is NOT security.

The API/database must still deny the operation.

---

# 64. AUDIT REQUIREMENTS FOR SENSITIVE PERMISSIONS

The following actions must always generate audit records:

```text
user.role_change
permission.change
repair_order.override
repair_order.cancel
repair_order.reopen
estimate.approve
supplement.approve
invoice.issue
invoice.void
payment.create
payment.reverse
payment.refund
customer.export
financial.export
document.download_sensitive
```

---

# 65. EMERGENCY ACCESS

Emergency access should not mean:

```text
disable RLS
```

Instead implement:

```text
break_glass_access
```

with:

```text
reason
user
timestamp
duration
resource
action
approval
```

Every emergency access event must be audited.

---

# 66. CUSTOMER DATA PROTECTION

Customer information should be treated as sensitive.

Examples:

```text
name
phone
email
address
ID information
insurance information
vehicle information
claim information
```

Access must be limited according to role and scope.

WorkShopOS should be designed with POPIA considerations because the PRD explicitly identifies POPIA-regulated personal data as a requirement.

---

# 67. API AUTHORIZATION CHECK

Every protected API operation should follow:

```text
Request
 ↓
Authenticate
 ↓
Identify user
 ↓
Identify organisation
 ↓
Identify branch
 ↓
Load permissions
 ↓
Check resource scope
 ↓
Check business rule
 ↓
Execute operation
 ↓
Audit
```

---

# 68. PERMISSION CHECK FUNCTION

Application code should expose a common function:

```typescript
hasPermission(
    user,
    "repair_order.transition"
)
```

And:

```typescript
assertPermission(
    user,
    "repair_order.transition"
)
```

For resource-level checks:

```typescript
assertCanAccessRepairOrder(
    user,
    repairOrderId
)
```

---

# 69. SERVER-SIDE RULE

Never rely on:

```typescript
const isAdmin = user.role === "admin";
```

as the sole security mechanism.

Prefer:

```typescript
await assertPermission(
    session.user.id,
    "invoice.void"
);
```

followed by:

```text
organisation scope
+
branch scope
+
resource scope
```

---

# 70. SUPABASE SECURITY

The Supabase service-role key must NEVER be exposed to the browser.

Never place:

```text
SUPABASE_SERVICE_ROLE_KEY
```

inside:

```text
NEXT_PUBLIC_*
VITE_*
React client code
browser localStorage
```

It must only exist in trusted server-side execution.

---

# 71. OFFLINE SECURITY

The PRD anticipates technician offline operation where updates are queued and synchronised later.

Offline mutations must contain:

```text
mutation_id
user_id
organisation_id
branch_id
resource
resource_id
operation
payload
created_at
client_timestamp
sync_status
```

The server must re-check permissions when synchronising.

Never assume:

```text
permission_when_created == permission_when_synced
```

---

# 72. OFFLINE MUTATION EXAMPLE

Technician creates:

```text
workflow.transition
```

while offline.

When synchronising:

```text
Offline Queue
 ↓
Authenticate
 ↓
Verify user
 ↓
Verify organisation
 ↓
Verify branch
 ↓
Verify current permission
 ↓
Verify workflow transition
 ↓
Verify gate conditions
 ↓
Commit transaction
 ↓
Audit
```

---

# 73. WORKFLOW OVERRIDE SECURITY

A normal technician:

```text
Painting → Assembly
```

may be blocked if parts have not been received.

Manager:

```text
workflow.override
```

may override.

But the override must require:

```text
reason
actor
timestamp
previous stage
new stage
gate that was bypassed
```

This directly addresses the PRD requirement for mandatory reasons when manually overriding workflow gates.

---

# 74. ROLE ASSIGNMENT SECURITY

Only users with:

```text
user.assign_role
```

may change roles.

Additional rule:

```text
User cannot grant permissions they themselves do not possess.
```

For example:

```text
Branch Manager
```

cannot assign:

```text
system_admin
```

to another user.

---

# 75. LAST ADMIN PROTECTION

The system must prevent removing the final organisation administrator.

Example:

```text
Organisation
  ↓
2 administrators
```

Admin A attempts to remove Admin B.

Allowed.

If:

```text
Organisation
  ↓
1 administrator
```

Admin attempts to remove themselves.

Denied unless another administrator has already been assigned.

---

# 76. DISABLED USERS

When a user is disabled:

```text
authentication access → revoked
active sessions → invalidated
future login → denied
pending sensitive operations → rejected
```

Historical records must remain associated with the original user.

Never replace historical actor information with:

```text
"Deleted User"
```

if the original audit identity can legally be retained.

---

# 77. ACCESS REVOCATION

When a user changes branch:

```text
Old branch permissions
        ↓
revoked
        ↓
New branch permissions
        ↓
activated
```

Existing sessions should refresh authorization claims.

---

# 78. SECURITY TEST MATRIX

Automated tests must verify:

### Tenant isolation

```text
Organisation A user
→ Organisation A record
✓ ALLOWED

Organisation A user
→ Organisation B record
✗ DENIED
```

### Branch isolation

```text
Branch A technician
→ Branch B RO
✗ DENIED
```

### Customer isolation

```text
Customer A
→ Customer B RO
✗ DENIED
```

### Financial isolation

```text
Technician
→ profit margin
✗ DENIED
```

### Role escalation

```text
Branch Manager
→ assign system_admin
✗ DENIED
```

### Audit protection

```text
Technician
→ modify audit log
✗ DENIED
```

---

# 79. PERMISSION IMPLEMENTATION PRIORITY

## MVP

Implement:

```text
authentication
organisation membership
branch membership
roles
permissions
repair order access
workflow access
estimate access
parts access
photo access
customer access
invoice access
audit access
customer portal access
```

## Phase 2

Add:

```text
custom roles
temporary permissions
insurer portal
advanced financial permissions
advanced reporting permissions
offline permission revalidation
```

## Phase 3

Add:

```text
attribute-based access control
advanced regional hierarchy
external identity providers
enterprise SSO
SCIM
delegated administration
fine-grained data classification
```

---

# 80. RECOMMENDED DEFAULT ROLE DEFINITIONS

## system_admin

```text
scope: global
permissions: *
```

## group_admin

```text
scope: organisation
organisation.*
branch.*
user.*
role.*
dashboard.*
report.*
audit.view
```

## regional_manager

```text
scope: selected branches
dashboard.*
report.*
repair_order.view
estimate.view
invoice.view
parts.view
```

## branch_manager

```text
scope: branch
customer.*
vehicle.*
repair_order.*
estimate.*
supplement.*
parts.*
workflow.*
qc.*
dashboard.*
report.*
```

Sensitive financial actions remain explicitly controlled.

## workshop_manager

```text
scope: branch
repair_order.*
workflow.*
parts.*
labour.*
photo.*
qc.view
dashboard.*
```

## service_advisor

```text
scope: branch
customer.*
vehicle.*
repair_order.create
repair_order.view
repair_order.update
photo.upload
signature.request
communication.*
```

## estimator

```text
scope: branch
repair_order.view
estimate.*
supplement.*
photo.view
photo.upload
document.*
```

## technician

```text
scope: assigned
repair_order.view_assigned
workflow.view_assigned
workflow.transition_assigned
labour.create_own
labour.update_own
photo.upload
parts.request
issue.create
notification.view
```

## parts_controller

```text
scope: branch
repair_order.view
parts.*
inventory.*
supplier.view
supplier.update
```

## quality_inspector

```text
scope: branch
repair_order.view
workflow.view
qc.*
photo.*
document.view
signature.verify
```

## finance

```text
scope: branch
customer.view
vehicle.view
repair_order.view
estimate.view
invoice.*
payment.*
report.financial
dashboard.view_financials
```

## manager_viewer

```text
scope: branch
dashboard.view
repair_order.view
estimate.view
parts.view
invoice.view
report.view
```

## insurer

```text
scope: assigned claims
insurer.*
```

## customer

```text
scope: own records
portal.*
```

---

# 81. GOLDEN RULES FOR AI VIBE CODING

When using an AI coding agent to build WorkShopOS, these rules must be treated as non-negotiable:

```text
1. Never disable RLS to solve an application problem.

2. Never use USING(true) on tenant-owned data.

3. Never expose the Supabase service-role key.

4. Never trust organisation_id from the browser.

5. Never trust branch_id from the browser.

6. Never trust role information supplied by the client.

7. Never allow frontend-only authorization.

8. Never allow technicians to modify financial records.

9. Never allow users to approve their own sensitive transactions.

10. Never allow customers to query arbitrary repair orders.

11. Never allow insurers to access unassigned claims.

12. Never allow audit logs to be edited by normal users.

13. Never allow workflow overrides without a reason.

14. Re-check permissions during offline synchronization.

15. Log sensitive operations.
```

---

# 82. FINAL AUTHORIZATION ARCHITECTURE

The final WorkShopOS authorization architecture should be:

```text
                         ┌─────────────────┐
                         │   Supabase Auth  │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │      User       │
                         └────────┬────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ Organisation Membership   │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Branch Membership      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │          Roles             │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │       Permissions          │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Resource Scope        │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Business Rules        │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │       PostgreSQL RLS       │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │     DATABASE    │
                         └─────────────────┘
```

This gives WorkShopOS a **scalable authorization model rather than a collection of hard-coded frontend roles**.

It also aligns the RBAC system with the PRD's core requirements: multi-tenant/branch isolation, technician-specific access, manager dashboards, estimating, supplements, parts, QC, invoicing, customer access, insurer access and auditability.

