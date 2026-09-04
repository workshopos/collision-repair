# ADR 0001: RBAC Contract Decisions

## Progress checklist

- [x] ADR documenting the accepted RBAC decisions exists.
- [x] Core role assignment and scope decisions are recorded.
- [ ] Final schema resolution for user-role assignment tables remains unresolved.
- [ ] Custom-role admin authority remains unresolved.
- [ ] ADR decisions have not been implemented in runtime code.

- Status: Accepted
- Date: 2026-08-30

## Context

WorkShopOS is a multi-tenant autobody repair platform that uses a modular monolith architecture and enforces tenant boundaries through server-side authorization and PostgreSQL RLS. The authoritative project documents are:

- AGENTS.md
- PRD.md
- ARCHITECTURE.md
- API_CONTRACTS.md
- RBAC_PERMISSION_MATRIX.md
- DATABASE.md

This ADR records the RBAC decisions already established by the project documentation and resolves only the specific questions that were previously unresolved.

This document does not implement RBAC, create migrations, modify application code, or invent permissions, roles, tables, columns, or inheritance rules.

## Current RBAC model

The current documented RBAC model is:

```text
User
 ↓
Organisation Membership
 ↓
Branch Membership
 ↓
Role Assignment
 ↓
Role
 ↓
Role Permissions
 ↓
Permission
```

The relevant constraints are:

- Tenant isolation is enforced through organisation and branch membership.
- The database is the final tenant boundary.
- The client must not be trusted to supply organisation_id, branch_id, role, or permissions.
- Authorization is enforced server-side.
- Permissions are explicit, not inherited.
- Users may hold multiple roles.
- Scope restrictions still apply.
- Direct user_permissions are not part of the MVP.
- No role priority hierarchy is used.
- Custom roles are organisation-scoped and flat.
- System roles are protected defaults.

## Decision summary

DecisionStatus

- Role assignment model: Accepted
- Branch role combination: Accepted
- Custom roles: Accepted
- System vs custom role ownership: Accepted
- Exact database schema: Still unresolved
- Custom-role administrator authority: Still unresolved

## Decisions

### 1. Role assignment model

Decision: Accepted

The role assignment model is accepted as a server-side concept separate from organisation and branch membership.

The documented model requires that:

- a user may hold multiple roles;
- permissions are granted explicitly through role-to-permission mappings;
- role assignment is evaluated server-side;
- tenant and branch access are enforced independently from client-supplied values.

This is supported by:

- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Users may hold multiple roles” and “Effective permissions: UNION(...)”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Only users with user.assign_role may change roles”
- [AGENTS.md](../../AGENTS.md): authorization must be server-side, and tenant ids from the browser are never trusted
- [API_CONTRACTS.md](../../API_CONTRACTS.md): server derives user_id, organisation_id, branch memberships, roles, and permissions from trusted server-side sources

Rationale:

The project explicitly separates membership from role assignment and requires authorization to be enforced in the backend. This preserves the existing tenant model and the modular-monolith architecture without introducing a new inheritance model.

### 2. Branch role combination

Decision: Accepted

Branch-scoped and organisation-scoped role assignments are allowed to coexist when the user is validly authorised for the relevant scope.

The documented model requires that:

- a user may hold multiple roles;
- effective permissions are the union of all active role permissions;
- scope restrictions still apply;
- no role priority hierarchy is used.

This is supported by:

- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Users may hold multiple roles”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “However, scope restrictions must still apply”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Do not implement role priority as admin > manager > technician”
- [DATABASE.md](../../DATABASE.md): organisation and branch memberships are distinct and both are enforced by tenant isolation

Rationale:

The project explicitly rejects role ranking and inheritance. The accepted model is therefore an explicit union of permissions, filtered by tenant and scope rules. This preserves separation of duties and keeps the model coherent without introducing new over-arching metadata.

### 3. Custom roles

Decision: Accepted

Custom roles are accepted as organisation-scoped roles that are created and modified by administrators.

The documented model requires that:

- custom roles are allowed;
- custom roles are flat and explicit;
- custom roles are not inheritance-based;
- custom roles do not replace the system-role model.

This is supported by:

- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Administrators should be able to create custom roles”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Custom roles → can be created; Custom roles → can be modified”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Do not implement role priority as admin > manager > technician”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “A custom role may legitimately have estimate.approve without being a manager”

Rationale:

The project deliberately supports custom roles while rejecting a hierarchy-based model. This makes custom roles explicit permission bundles for an organisation, without introducing unrelated inheritance semantics.

### 4. System vs custom role ownership

Decision: Accepted

System roles are protected platform defaults.
Custom roles are organisation-owned administrative configuration.

The documented model requires that:

- default system roles are protected;
- system roles cannot be deleted;
- custom roles can be created and modified;
- ownership is separated between the platform and the organisation.

This is supported by:

- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Default system roles should be protected”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “System roles → cannot be deleted”
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): “Custom roles → can be created; Custom roles → can be modified”
- [DATABASE.md](../../DATABASE.md): organisation and branch memberships provide the tenant ownership boundary for each organisation

Rationale:

The project documents a clear distinction between system-provided defaults and organisation-specific configuration. This preserves the platform baseline while allowing tenant-specific role construction without adding a separate role inheritance model.

## Decisions left unresolved

### Exact database schema

Status: Still unresolved

The documentation does not authoritatively define the final database table structure for the role assignment layer.

The project describes recommended tables and fields in [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md), but those are not finalised schema contracts for the repository. The docs support the concept of role assignment, but they do not yet determine the exact table names, columns, and constraints.

This ADR does not assume a final schema. It only records the accepted model and leaves storage-level detail for the schema review stage.

### Custom-role administrator authority

Status: Still unresolved

The documentation requires that administrators can create and modify custom roles, but it does not define exactly which roles count as administrators for this purpose, or whether custom-role creation authority is inherited from a broader organisation-admin permission or a specific role-management permission.

This ADR therefore records the accepted concept, while leaving the exact authority boundary for the next review.

## Compatibility review

This ADR is compatible with the existing project source-of-truth:

- [AGENTS.md](../../AGENTS.md): preserves security requirements and no-inventing-permissions rule
- [ARCHITECTURE.md](../../ARCHITECTURE.md): preserves modular monolith and backend enforcement
- [API_CONTRACTS.md](../../API_CONTRACTS.md): preserves server-side authorization and no trust in client tenant data
- [RBAC_PERMISSION_MATRIX.md](../../RBAC_PERMISSION_MATRIX.md): directly supports the accepted decisions
- [DATABASE.md](../../DATABASE.md): preserves tenant isolation and organisation/branch membership separation

## No implementation implied

This ADR is documentation-only and intentionally does not:

- implement RBAC;
- create migrations;
- create API endpoints;
- add permissions or roles;
- create any custom schema;
- assume exact storage columns until the schema review is complete.

## Next step

The next task is a documentation-only RBAC schema resolution review, not implementation.

That review must establish whether the eventual model requires a structure such as:

```text
user_role_assignments
├── user_id
├── role_id
├── organisation_id
├── branch_id (nullable)
└── ...
```

but must not assume those columns are correct until the authoritative documents support them.

After schema review approval, implementation may proceed with the RBAC Foundation vertical slice.
