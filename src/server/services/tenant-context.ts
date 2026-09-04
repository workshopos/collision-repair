import { AuthenticationRequiredError, getCurrentUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/auth/server";
import {
  resolveCurrentTenantContext,
  requireTenantMembership,
} from "@/src/lib/tenant";

export type TenantContextInput = {
  organisationId?: string;
  branchId?: string | null;
};

export type TenantContext = {
  organisationId: string;
  branchId?: string | null;
};

export type UserTenantMemberships = {
  organisationIds: Set<string>;
  branchIds: Set<string>;
  branchOrganisationMap: Map<string, string>;
};

export function normaliseTenantContext(
  input: TenantContextInput = {},
): TenantContext {
  const organisationId = input.organisationId?.trim();
  const branchId = input.branchId?.trim() ?? null;

  if (!organisationId) {
    throw new Error("Organisation ID is required for tenant resolution.");
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(organisationId)) {
    throw new Error("Organisation ID must be a valid UUID.");
  }

  if (branchId && !/^[0-9a-fA-F-]{36}$/.test(branchId)) {
    throw new Error("Branch ID must be a valid UUID when provided.");
  }

  return {
    organisationId,
    branchId: branchId ?? undefined,
  };
}

export async function getAuthenticatedUserTenantMemberships(): Promise<UserTenantMemberships> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  const client = await createServerSupabaseClient();

  const [organisationMemberships, branchMemberships] = await Promise.all([
    client
      .from("organisation_memberships")
      .select("organisation_id")
      .eq("profile_id", user.id)
      .eq("is_active", true),
    client
      .from("branch_memberships")
      .select("organisation_id, branch_id")
      .eq("profile_id", user.id)
      .eq("is_active", true),
  ]);

  if (organisationMemberships.error) {
    throw organisationMemberships.error;
  }

  if (branchMemberships.error) {
    throw branchMemberships.error;
  }

  const organisationIds = new Set<string>(
    (organisationMemberships.data ?? [])
      .map((row) => row.organisation_id)
      .filter((value): value is string => Boolean(value)),
  );

  const branchOrganisationMap = new Map<string, string>();
  for (const row of branchMemberships.data ?? []) {
    if (row.branch_id && row.organisation_id) {
      branchOrganisationMap.set(row.branch_id, row.organisation_id);
    }
  }

  return {
    organisationIds,
    branchIds: new Set(branchOrganisationMap.keys()),
    branchOrganisationMap,
  };
}

export async function defaultTenantMembershipCheck(
  scope: TenantContext,
): Promise<boolean> {
  const memberships = await getAuthenticatedUserTenantMemberships();

  if (!memberships.organisationIds.has(scope.organisationId)) {
    return false;
  }

  if (!scope.branchId) {
    return true;
  }

  const branchOrganisationId = memberships.branchOrganisationMap.get(
    scope.branchId,
  );
  return (
    Boolean(branchOrganisationId) &&
    branchOrganisationId === scope.organisationId &&
    memberships.branchIds.has(scope.branchId)
  );
}

export async function resolveTenantContext(input: TenantContextInput = {}) {
  return resolveCurrentTenantContext(normaliseTenantContext(input));
}

export async function assertTenantMembership(
  input: TenantContextInput,
  membershipCheck: (scope: {
    organisationId: string;
    branchId?: string | null;
  }) => boolean | Promise<boolean> = defaultTenantMembershipCheck,
) {
  const scope = normaliseTenantContext(input);

  return requireTenantMembership(scope, membershipCheck);
}

// Public auth/login and health-check endpoints are intentionally tenant-agnostic.
// Any tenant-aware route or service entry point must call this helper before business logic.
export async function enforceTenantContract<T>(
  input: TenantContextInput,
  businessAction: (scope: TenantContext) => Promise<T>,
  membershipCheck: (
    scope: TenantContext,
  ) => boolean | Promise<boolean> = defaultTenantMembershipCheck,
): Promise<T> {
  const scope = await resolveTenantContext(input);
  await assertTenantMembership(scope, membershipCheck);

  return businessAction(scope);
}

export async function enforceTenantRequestBoundary<T>(
  input: TenantContextInput,
  businessAction: (scope: TenantContext) => Promise<T>,
  membershipCheck: (
    scope: TenantContext,
  ) => boolean | Promise<boolean> = defaultTenantMembershipCheck,
): Promise<T> {
  return enforceTenantContract(input, businessAction, membershipCheck);
}
