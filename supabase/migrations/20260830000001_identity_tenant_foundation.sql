create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (length(trim(slug)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  code text not null check (length(trim(code)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (organisation_id, code),
  unique (organisation_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, profile_id)
);

create table if not exists public.branch_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  branch_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, branch_id, profile_id),
  foreign key (branch_id, organisation_id)
    references public.branches(id, organisation_id)
    on delete cascade
);

create index if not exists idx_organisations_slug
  on public.organisations (slug);

create index if not exists idx_branches_organisation_id
  on public.branches (organisation_id);

create index if not exists idx_branches_active_organisation
  on public.branches (organisation_id, is_active);

create index if not exists idx_profiles_display_name
  on public.profiles (display_name);

create index if not exists idx_organisation_memberships_profile_id
  on public.organisation_memberships (profile_id);

create index if not exists idx_organisation_memberships_organisation_id
  on public.organisation_memberships (organisation_id);

create index if not exists idx_organisation_memberships_active
  on public.organisation_memberships (organisation_id, profile_id, is_active);

create index if not exists idx_branch_memberships_profile_id
  on public.branch_memberships (profile_id);

create index if not exists idx_branch_memberships_branch_id
  on public.branch_memberships (branch_id);

create index if not exists idx_branch_memberships_active
  on public.branch_memberships (organisation_id, branch_id, profile_id, is_active);

drop trigger if exists trg_organisations_updated_at on public.organisations;
create trigger trg_organisations_updated_at
before update on public.organisations
for each row execute function public.set_updated_at();

drop trigger if exists trg_branches_updated_at on public.branches;
create trigger trg_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_organisation_memberships_updated_at on public.organisation_memberships;
create trigger trg_organisation_memberships_updated_at
before update on public.organisation_memberships
for each row execute function public.set_updated_at();

drop trigger if exists trg_branch_memberships_updated_at on public.branch_memberships;
create trigger trg_branch_memberships_updated_at
before update on public.branch_memberships
for each row execute function public.set_updated_at();

alter table public.organisations enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.branch_memberships enable row level security;

create policy "organisations_members_only_select"
on public.organisations
for select
using (
  exists (
    select 1
    from public.organisation_memberships om
    where om.organisation_id = organisations.id
      and om.profile_id = auth.uid()
      and om.is_active = true
  )
);

create policy "organisations_service_only_write"
on public.organisations
for all
using (false)
with check (false);

create policy "branches_members_only_select"
on public.branches
for select
using (
  exists (
    select 1
    from public.branch_memberships bm
    where bm.branch_id = branches.id
      and bm.profile_id = auth.uid()
      and bm.is_active = true
  )
  or exists (
    select 1
    from public.organisation_memberships om
    where om.organisation_id = branches.organisation_id
      and om.profile_id = auth.uid()
      and om.is_active = true
  )
);

create policy "branches_service_only_write"
on public.branches
for all
using (false)
with check (false);

create policy "profiles_own_record_select"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_service_only_write"
on public.profiles
for all
using (false)
with check (false);

create policy "organisation_memberships_own_select"
on public.organisation_memberships
for select
using (profile_id = auth.uid());

create policy "organisation_memberships_service_only_write"
on public.organisation_memberships
for all
using (false)
with check (false);

create policy "branch_memberships_own_select"
on public.branch_memberships
for select
using (profile_id = auth.uid());

create policy "branch_memberships_service_only_write"
on public.branch_memberships
for all
using (false)
with check (false);
