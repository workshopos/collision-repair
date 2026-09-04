// RBAC module barrel exports
// Validation schemas for role and permission inputs
export {
  roleSchema,
  permissionAssignmentSchema,
  rolePermissionMappingSchema,
  userRoleAssignmentSchema,
  batchRoleAssignmentSchema,
  permissionCheckSchema,
  validateRoleAssignmentScope,
  type RoleInput,
  type PermissionAssignmentInput,
  type RolePermissionMappingInput,
  type UserRoleAssignmentInput,
  type BatchRoleAssignmentInput,
  type PermissionCheckInput,
} from "./validation";
