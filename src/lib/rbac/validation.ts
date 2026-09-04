import { z } from "zod";

// UUID validation
const uuidSchema = z.string().uuid();

// Role creation/update validation
export const roleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(255),
  slug: z
    .string()
    .trim()
    .min(1, "Role slug is required")
    .max(255)
    .regex(
      /^[a-z0-9_-]+$/,
      "Slug must contain only lowercase letters, numbers, hyphens, and underscores",
    ),
  description: z.string().max(1000).optional().nullable(),
  is_system_role: z.boolean().optional().default(false),
});

export type RoleInput = {
  name: string;
  slug: string;
  description?: string | null;
  is_system_role?: boolean;
};

// Permission assignment validation
export const permissionAssignmentSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(
      /^[a-z_]+\.[a-z_]+$/,
      "Permission key must be in format: resource.action",
    ),
  resource: z.string().trim().min(1),
  action: z.string().trim().min(1),
  description: z.string().max(1000).optional().nullable(),
});

export type PermissionAssignmentInput = z.infer<
  typeof permissionAssignmentSchema
>;

// Role-Permission mapping validation
export const rolePermissionMappingSchema = z.object({
  roleId: uuidSchema,
  permissionId: uuidSchema,
});

export type RolePermissionMappingInput = z.infer<
  typeof rolePermissionMappingSchema
>;

// User role assignment validation
// Note: Both roleId and organisationId are required
// branchId is optional: NULL = organisation-scoped, UUID = branch-scoped
export const userRoleAssignmentSchema = z.object({
  profileId: uuidSchema,
  roleId: uuidSchema,
  organisationId: uuidSchema,
  branchId: uuidSchema.optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type UserRoleAssignmentInput = {
  profileId: string;
  roleId: string;
  organisationId: string;
  branchId?: string | null;
  isActive?: boolean;
};

// Batch role assignment validation (for seeders and admin operations)
export const batchRoleAssignmentSchema = z.array(userRoleAssignmentSchema);

export type BatchRoleAssignmentInput = z.infer<
  typeof batchRoleAssignmentSchema
>;

// Permission check input
export const permissionCheckSchema = z.object({
  userId: uuidSchema,
  permission: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  organisationId: uuidSchema.optional(),
  branchId: uuidSchema.optional().nullable(),
});

export type PermissionCheckInput = z.infer<typeof permissionCheckSchema>;

// Role assignment validation helper
// Validates organisational and branch consistency
export const validateRoleAssignmentScope = (
  input: UserRoleAssignmentInput,
  rolePrimaryScope?: "global" | "organisation" | "branch",
): boolean => {
  // If role is branch-scoped, branchId must be provided
  if (rolePrimaryScope === "branch" && !input.branchId) {
    return false;
  }
  // If role is global or organisation-scoped, branchId should be null
  if (
    (rolePrimaryScope === "global" || rolePrimaryScope === "organisation") &&
    input.branchId
  ) {
    return false;
  }
  return true;
};
