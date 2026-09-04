# WorkShopOS Database Foundation

## Progress checklist

- [x] Identity and tenancy scope is documented.
- [x] Organisations, branches, profiles, and memberships are defined.
- [x] Migration foundation for the core tenant model exists in the repo.
- [x] RLS principles and tenant-isolation goals are documented.
- [ ] Full runtime enforcement and validation beyond the migration scaffold remains pending.
- [ ] Domain tables for customers, vehicles, repair orders, workflow, and finance remain pending.

This document captures the minimum database foundation for the tenant-aware identity model defined by the project requirements.

## Scope

This foundation is intentionally limited to the identity and tenancy layer required before feature modules such as customers, vehicles, repair orders, invoices, and workflow can be introduced.

## Tables

### organisations

Purpose: top-level tenant container for a business entity.

Columns:

- id: UUID primary key
- name: text, required
- slug: text, required, unique
- created_at: timestamptz, required
- updated_at: timestamptz, required

### branches

Purpose: operational branch within an organisation.

Columns:

- id: UUID primary key
- organisation_id: UUID, required, references organisations
- name: text, required
- code: text, required
- is_active: boolean, default true
- created_at: timestamptz, required
- updated_at: timestamptz, required

### profiles

Purpose: user identity record backed by Supabase Auth.

Columns:

- id: UUID primary key, references auth.users
- full_name: text, optional
- display_name: text, optional
- avatar_url: text, optional
- created_at: timestamptz, required
- updated_at: timestamptz, required

### organisation_memberships

Purpose: allows a profile to belong to an organisation.

Columns:

- id: UUID primary key
- organisation_id: UUID, required, references organisations
- profile_id: UUID, required, references profiles
- is_active: boolean, default true
- created_at: timestamptz, required
- updated_at: timestamptz, required

### branch_memberships

Purpose: allows a profile to access a branch within an organisation.

Columns:

- id: UUID primary key
- organisation_id: UUID, required, references organisations
- branch_id: UUID, required, references branches
- profile_id: UUID, required, references profiles
- is_active: boolean, default true
- created_at: timestamptz, required
- updated_at: timestamptz, required

## Security model

- Supabase Auth is the source of authenticated user identity.
- The database is the final tenant boundary.
- All tenant scoping must be enforced by RLS and server-side checks.
- Browser-supplied organisation_id and branch_id values are never trusted.
- The service role key must remain server-only.

## RLS principles

The migration enforces:

- organisation members can read only their own organisation
- branch members can read only their authorised branches
- non-members cannot read organisation or branch data
- writes are restricted by default to trusted server-side code paths

## Constraints and indexes

The migration includes:

- foreign key constraints
- unique membership constraints
- organisation and branch uniqueness rules
- tenant-aware access indexes for common lookup paths

## Notes

This is intentionally the minimum identity and tenancy model required before RBAC and feature modules can be added safely.
