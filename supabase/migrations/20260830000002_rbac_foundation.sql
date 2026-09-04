-- Slice 3: RBAC Foundation
-- Approved MVP: User → Role → Permissions
-- Custom roles are organisation-scoped
-- No role inheritance, no user-level permission overrides

-- Roles table: organisation-scoped or system roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (length(trim(slug)) > 0),
  description text,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, slug)
);

-- Permissions table: immutable system-wide permissions
-- Format: resource.action (e.g., customer.view, invoice.void)
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(trim(key)) > 0),
  resource text not null check (length(trim(resource)) > 0),
  action text not null check (length(trim(action)) > 0),
  description text,
  created_at timestamptz not null default now()
);

-- Role-Permission mapping: explicit permissions for each role
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- User Role Assignment: profile → role within organisation (+ optional branch)
-- UNIQUE constraint prevents duplicate assignments
-- branch_id is nullable: NULL = organisation-scoped role, non-NULL = branch-scoped role
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, role_id, organisation_id, branch_id),
  foreign key (branch_id, organisation_id)
    references public.branches(id, organisation_id)
    on delete cascade
);

-- Indexes for common queries
create index if not exists idx_roles_organisation_id
  on public.roles (organisation_id);

create index if not exists idx_roles_is_system
  on public.roles (is_system_role);

create index if not exists idx_permissions_key
  on public.permissions (key);

create index if not exists idx_permissions_resource
  on public.permissions (resource);

create index if not exists idx_permissions_action
  on public.permissions (action);

create index if not exists idx_role_permissions_role_id
  on public.role_permissions (role_id);

create index if not exists idx_role_permissions_permission_id
  on public.role_permissions (permission_id);

create index if not exists idx_user_roles_profile_id
  on public.user_roles (profile_id);

create index if not exists idx_user_roles_organisation_id
  on public.user_roles (organisation_id);

create index if not exists idx_user_roles_role_id
  on public.user_roles (role_id);

create index if not exists idx_user_roles_active
  on public.user_roles (profile_id, organisation_id, is_active);

create index if not exists idx_user_roles_branch_active
  on public.user_roles (organisation_id, branch_id, profile_id, is_active);

-- Triggers for updated_at timestamps
drop trigger if exists trg_roles_updated_at on public.roles;
create trigger trg_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

-- Row Level Security

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Roles: organisation members can read their own organisation's roles
create policy "roles_members_only_select"
on public.roles
for select
using (
  is_system_role = true
  or exists (
    select 1
    from public.organisation_memberships om
    where om.organisation_id = roles.organisation_id
      and om.profile_id = auth.uid()
      and om.is_active = true
  )
);

-- Roles: write operations are service role only (enforced by default deny)
create policy "roles_service_only_write"
on public.roles
for all
using (false)
with check (false);

-- Permissions: all users can read (immutable system data)
create policy "permissions_public_select"
on public.permissions
for select
using (true);

-- Permissions: write operations are service role only
create policy "permissions_service_only_write"
on public.permissions
for all
using (false)
with check (false);

-- Role Permissions: all users can read
create policy "role_permissions_public_select"
on public.role_permissions
for select
using (true);

-- Role Permissions: write operations are service role only
create policy "role_permissions_service_only_write"
on public.role_permissions
for all
using (false)
with check (false);

-- User Roles: users can read their own role assignments
create policy "user_roles_own_select"
on public.user_roles
for select
using (profile_id = auth.uid());

-- User Roles: write operations are service role only
create policy "user_roles_service_only_write"
on public.user_roles
for all
using (false)
with check (false);
