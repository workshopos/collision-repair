import { createServerSupabaseClient } from "@/src/lib/auth/server";
import { createAdminSupabaseClient } from "@/src/lib/auth/server";
import { enforceTenantRequestBoundary } from "@/src/server/services/tenant-context";

export class RbacAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 403 | 404,
  ) {
    super(message);
    this.name = "RbacAuthorizationError";
  }
}

/**
 * Role assignment with full role and permission data
 */
export interface RoleAssignment {
  id: string;
  profileId: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  organisationId: string;
  branchId: string | null;
  isActive: boolean;
  permissions: Set<string>; // permission keys
}

/**
 * User's effective permissions in a scope
 */
export interface EffectivePermissions {
  userId: string;
  organisationId?: string;
  branchId?: string | null;
  permissions: Set<string>;
  roleAssignments: RoleAssignment[];
}

/**
 * Gets all active role assignments for a user in a specific organisation
 * @param userId - profile_id
 * @param organisationId - organisation_id to scope the query
 * @param branchId - optional branch_id to filter branch-scoped roles
 */
type UserRoleRow = {
  id: string;
  profile_id: string;
  role_id: string;
  organisation_id: string;
  branch_id: string | null;
  is_active: boolean;
  roles?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type RolePermissionRow = {
  role_id: string;
  permissions?: { key: string } | null;
};

export async function getRoleAssignments(
  userId: string,
  organisationId: string,
  branchId?: string | null,
): Promise<RoleAssignment[]> {
  return enforceTenantRequestBoundary(
    { organisationId, branchId },
    async (scope) => {
      const client = await createServerSupabaseClient();

      // Base query: active user_roles in the specified organisation
      let query = client
        .from("user_roles")
        .select(
          `
          id,
          profile_id,
          role_id,
          roles!inner (
            id,
            name,
            slug
          ),
          organisation_id,
          branch_id,
          is_active
        `,
        )
        .eq("profile_id", userId)
        .eq("organisation_id", scope.organisationId)
        .eq("is_active", true);

      // If branchId is provided, include both organisation-scoped (NULL branch) and this branch
      if (scope.branchId) {
        query = query.or(`branch_id.eq.${scope.branchId},branch_id.is.null`);
      } else {
        // If no branchId filter, get only organisation-scoped roles
        query = query.is("branch_id", null);
      }

      const { data: userRolesData, error } = await query;
      if (error) throw error;

      const userRoles = (userRolesData ?? []) as unknown as UserRoleRow[];

      if (userRoles.length === 0) {
        return [];
      }

      // Fetch all permissions for these roles in one query
      const roleIds = userRoles.map((ur) => ur.role_id);
      const { data: rolePermissionsData, error: rpError } = await client
        .from("role_permissions")
        .select(
          `
          role_id,
          permissions!inner (
            key
          )
        `,
        )
        .in("role_id", roleIds);

      if (rpError) throw rpError;

      const rolePermissions = (rolePermissionsData ??
        []) as unknown as RolePermissionRow[];

      // Build a map of role_id → Set<permission_keys>
      const rolePermissionMap = new Map<string, Set<string>>();
      if (rolePermissions) {
        rolePermissions.forEach((rp) => {
          const permission = rp.permissions;
          if (!permission) {
            return;
          }
          if (!rolePermissionMap.has(rp.role_id)) {
            rolePermissionMap.set(rp.role_id, new Set());
          }
          rolePermissionMap.get(rp.role_id)!.add(permission.key);
        });
      }

      // Convert to RoleAssignment objects
      return userRoles.map((ur) => ({
        id: ur.id,
        profileId: ur.profile_id,
        roleId: ur.role_id,
        roleName: ur.roles?.name ?? "",
        roleSlug: ur.roles?.slug ?? "",
        organisationId: ur.organisation_id,
        branchId: ur.branch_id,
        isActive: ur.is_active,
        permissions: rolePermissionMap.get(ur.role_id) || new Set(),
      }));
    },
  );
}

/**
 * Computes effective permissions for a user in an organisation
 * Combines all active role permissions (UNION)
 * @param userId - profile_id
 * @param organisationId - organisation_id
 * @param branchId - optional branch_id to include branch-scoped roles
 */
export async function getEffectivePermissions(
  userId: string,
  organisationId: string,
  branchId?: string | null,
): Promise<EffectivePermissions> {
  return enforceTenantRequestBoundary(
    { organisationId, branchId },
    async (scope) => {
      const roleAssignments = await getRoleAssignments(
        userId,
        scope.organisationId,
        scope.branchId,
      );

      // Union all permissions from all roles
      const permissions = new Set<string>();
      roleAssignments.forEach((assignment) => {
        assignment.permissions.forEach((perm) => {
          permissions.add(perm);
        });
      });

      return {
        userId,
        organisationId: scope.organisationId,
        branchId: scope.branchId ?? null,
        permissions,
        roleAssignments,
      };
    },
  );
}

/**
 * Checks if a user has a specific permission in an organisation
 * Implements DEFAULT DENY: NO PERMISSION = NO ACCESS
 * @param userId - profile_id
 * @param permission - permission key (e.g., "customer.view")
 * @param organisationId - organisation_id
 * @param branchId - optional branch_id for branch-scoped checks
 */
export async function hasPermission(
  userId: string,
  permission: string,
  organisationId: string,
  branchId?: string | null,
): Promise<boolean> {
  const effective = await getEffectivePermissions(
    userId,
    organisationId,
    branchId,
  );
  return effective.permissions.has(permission);
}

/**
 * Asserts that a user has a specific permission
 * Throws if user lacks permission (used for server-side authorization checks)
 * @param userId - profile_id
 * @param permission - permission key
 * @param organisationId - organisation_id
 * @param branchId - optional branch_id
 */
export async function assertPermission(
  userId: string,
  permission: string,
  organisationId: string,
  branchId?: string | null,
): Promise<void> {
  return enforceTenantRequestBoundary(
    { organisationId, branchId },
    async (scope) => {
      const hasAccess = await hasPermission(
        userId,
        permission,
        scope.organisationId,
        scope.branchId,
      );
      if (!hasAccess) {
        throw new Error(
          `User ${userId} lacks permission '${permission}' in organisation ${scope.organisationId}${scope.branchId ? ` branch ${scope.branchId}` : ""}`,
        );
      }
    },
  );
}

/**
 * Checks if an actor can assign a role to a target user
 * Requires: actor has "user.assign_role" permission
 * @param actorId - profile_id of person assigning the role
 * @param targetUserId - profile_id receiving the role
 * @param roleId - role_id to assign
 * @param organisationId - organisation_id for the assignment
 * @param branchId - optional branch scope for the assignment
 */
export async function canAssignRole(
  actorId: string,
  targetUserId: string,
  roleId: string,
  organisationId: string,
  branchId?: string | null,
): Promise<boolean> {
  try {
    await authorizeRoleMutation({
      actorId,
      targetUserId,
      roleId,
      organisationId,
      branchId,
      requirePermissionContainment: true,
    });
    return true;
  } catch (error) {
    if (error instanceof RbacAuthorizationError) {
      return false;
    }
    throw error;
  }
}

/**
 * Assigns a role to a user
 * Independently checks actor authorization before using the service-role client.
 * Idempotent: if assignment already exists and is active, returns success
 */
export async function assignRole(
  actorId: string,
  targetUserId: string,
  roleId: string,
  organisationId: string,
  branchId?: string | null,
): Promise<{ id: string; created: boolean }> {
  await authorizeRoleMutation({
    actorId,
    targetUserId,
    roleId,
    organisationId,
    branchId,
    requirePermissionContainment: true,
  });

  const client = await createAdminSupabaseClient();

  // Check if assignment already exists
  const { data: existing } = await client
    .from("user_roles")
    .select("id, is_active")
    .eq("profile_id", targetUserId)
    .eq("role_id", roleId)
    .eq("organisation_id", organisationId)
    .is("branch_id", branchId ?? null)
    .maybeSingle();

  if (existing) {
    // If already active, return success with created=false
    if (existing.is_active) {
      return { id: existing.id, created: false };
    }
    // If inactive, reactivate it
    await client
      .from("user_roles")
      .update({ is_active: true })
      .eq("id", existing.id);
    return { id: existing.id, created: false };
  }

  // Create new assignment
  const { data, error } = await client
    .from("user_roles")
    .insert({
      profile_id: targetUserId,
      role_id: roleId,
      organisation_id: organisationId,
      branch_id: branchId ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, created: true };
}

/**
 * Deactivates a role assignment for a user
 * Does not delete the record (preserves audit trail)
 */
export async function removeRole(
  actorId: string,
  targetUserId: string,
  roleId: string,
  organisationId: string,
  branchId?: string | null,
): Promise<void> {
  await authorizeRoleMutation({
    actorId,
    targetUserId,
    roleId,
    organisationId,
    branchId,
    requirePermissionContainment: false,
  });

  const client = await createAdminSupabaseClient();

  const { error } = await client
    .from("user_roles")
    .update({ is_active: false })
    .eq("profile_id", targetUserId)
    .eq("role_id", roleId)
    .eq("organisation_id", organisationId)
    .is("branch_id", branchId ?? null);

  if (error) throw error;
}

type RoleMutationInput = {
  actorId: string;
  targetUserId: string;
  roleId: string;
  organisationId: string;
  branchId?: string | null;
  requirePermissionContainment: boolean;
};

async function getPermissionKeys(
  client: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
  userId: string,
  organisationId: string,
  branchId: string | null,
): Promise<Set<string>> {
  let query = client
    .from("user_roles")
    .select("role_id")
    .eq("profile_id", userId)
    .eq("organisation_id", organisationId)
    .eq("is_active", true);

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  } else {
    query = query.is("branch_id", null);
  }

  const { data: assignments, error: assignmentError } = await query;
  if (assignmentError) throw assignmentError;

  const roleIds = (assignments ?? []).map((row) => row.role_id);
  if (roleIds.length === 0) return new Set();

  const { data, error } = await client
    .from("role_permissions")
    .select("permissions!inner(key)")
    .in("role_id", roleIds);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => {
        const permissions = row.permissions as unknown as
          | { key: string }
          | { key: string }[]
          | null;
        return Array.isArray(permissions)
          ? permissions[0]?.key
          : permissions?.key;
      })
      .filter((key): key is string => Boolean(key)),
  );
}

async function authorizeRoleMutation(input: RoleMutationInput): Promise<void> {
  const client = await createAdminSupabaseClient();
  const branchId = input.branchId ?? null;

  const { data: actorOrganisationMembership, error: actorOrganisationError } =
    await client
      .from("organisation_memberships")
      .select("profile_id, organisation_id, is_active")
      .eq("profile_id", input.actorId)
      .eq("organisation_id", input.organisationId)
      .eq("is_active", true)
      .maybeSingle();
  if (actorOrganisationError) throw actorOrganisationError;
  if (!actorOrganisationMembership) {
    throw new RbacAuthorizationError(
      "Actor is not an active member of the target organisation.",
      403,
    );
  }

  if (branchId) {
    const { data: branch, error: branchError } = await client
      .from("branches")
      .select("id, organisation_id")
      .eq("id", branchId)
      .eq("organisation_id", input.organisationId)
      .maybeSingle();
    if (branchError) throw branchError;
    if (!branch) {
      throw new RbacAuthorizationError(
        "Target role assignment scope was not found.",
        404,
      );
    }

    const { data: actorBranchMembership, error: actorBranchError } =
      await client
        .from("branch_memberships")
        .select("profile_id, organisation_id, branch_id, is_active")
        .eq("profile_id", input.actorId)
        .eq("organisation_id", input.organisationId)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .maybeSingle();
    if (actorBranchError) throw actorBranchError;
    if (!actorBranchMembership) {
      throw new RbacAuthorizationError(
        "Actor is not an active member of the target branch.",
        403,
      );
    }
  }

  const { data: targetOrganisationMembership, error: targetOrganisationError } =
    await client
      .from("organisation_memberships")
      .select("profile_id, organisation_id, is_active")
      .eq("profile_id", input.targetUserId)
      .eq("organisation_id", input.organisationId)
      .eq("is_active", true)
      .maybeSingle();
  if (targetOrganisationError) throw targetOrganisationError;
  if (!targetOrganisationMembership) {
    throw new RbacAuthorizationError(
      "Target user was not found in the target organisation.",
      404,
    );
  }

  if (branchId) {
    const { data: targetBranchMembership, error: targetBranchError } =
      await client
        .from("branch_memberships")
        .select("profile_id, organisation_id, branch_id, is_active")
        .eq("profile_id", input.targetUserId)
        .eq("organisation_id", input.organisationId)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .maybeSingle();
    if (targetBranchError) throw targetBranchError;
    if (!targetBranchMembership) {
      throw new RbacAuthorizationError(
        "Target user was not found in the target branch.",
        404,
      );
    }
  }

  const { data: role, error: roleError } = await client
    .from("roles")
    .select("id, organisation_id, is_system_role, slug")
    .eq("id", input.roleId)
    .eq("organisation_id", input.organisationId)
    .maybeSingle();
  if (roleError) throw roleError;
  if (
    !role ||
    role.is_system_role ||
    role.slug === "system_admin" ||
    role.slug === "group_admin"
  ) {
    throw new RbacAuthorizationError(
      "Role was not found in the target organisation.",
      404,
    );
  }

  const actorPermissions = await getPermissionKeys(
    client,
    input.actorId,
    input.organisationId,
    branchId,
  );
  if (!actorPermissions.has("user.assign_role")) {
    throw new RbacAuthorizationError(
      "Actor lacks permission 'user.assign_role'.",
      403,
    );
  }

  if (!input.requirePermissionContainment) return;

  const { data: rolePermissions, error: rolePermissionsError } = await client
    .from("role_permissions")
    .select("permissions!inner(key)")
    .eq("role_id", role.id);
  if (rolePermissionsError) throw rolePermissionsError;

  const missingPermission = (rolePermissions ?? [])
    .map((row) => {
      const permissions = row.permissions as unknown as
        | { key: string }
        | { key: string }[]
        | null;
      return Array.isArray(permissions)
        ? permissions[0]?.key
        : permissions?.key;
    })
    .find((permission) => permission && !actorPermissions.has(permission));
  if (missingPermission) {
    throw new RbacAuthorizationError(
      `Actor cannot grant permission '${missingPermission}'.`,
      403,
    );
  }
}

/**
 * Gets the role definition by slug and organisation
 * Used for UI/validation purposes
 */
export async function getRoleBySlug(
  roleSlug: string,
  organisationId?: string | null,
): Promise<{
  id: string;
  name: string;
  slug: string;
  organisation_id: string | null;
  is_system_role: boolean;
} | null> {
  const client = await createServerSupabaseClient();

  let query = client
    .from("roles")
    .select("id, name, slug, organisation_id, is_system_role")
    .eq("slug", roleSlug);

  // If organisationId provided, filter to that org or system roles
  if (organisationId) {
    query = query.or(
      `organisation_id.eq.${organisationId},organisation_id.is.null`,
    );
  } else {
    // If no org specified, only get system roles
    query = query.is("organisation_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}
