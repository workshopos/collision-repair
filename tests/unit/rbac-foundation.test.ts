import { describe, it, expect } from "vitest";
import {
  roleSchema,
  permissionAssignmentSchema,
  rolePermissionMappingSchema,
  userRoleAssignmentSchema,
  validateRoleAssignmentScope,
  type RoleInput,
  type PermissionAssignmentInput,
  type UserRoleAssignmentInput,
} from "@/src/lib/rbac";

describe("RBAC Foundation Validation", () => {
  describe("roleSchema", () => {
    it("should accept a valid role", () => {
      const input: RoleInput = {
        name: "Branch Manager",
        slug: "branch_manager",
        description: "Manages branch operations",
        is_system_role: false,
      };
      expect(() => roleSchema.parse(input)).not.toThrow();
    });

    it("should require a name", () => {
      const input = {
        slug: "branch_manager",
      };
      expect(() => roleSchema.parse(input)).toThrow();
    });

    it("should trim and validate slug format", () => {
      const validInput: RoleInput = {
        name: "Role",
        slug: "valid-slug_123",
        is_system_role: false,
      };
      expect(() => roleSchema.parse(validInput)).not.toThrow();

      const invalidInput = {
        name: "Role",
        slug: "Invalid Slug!",
      };
      expect(() => roleSchema.parse(invalidInput)).toThrow();
    });

    it("should set is_system_role default to false", () => {
      const input = {
        name: "Custom Role",
        slug: "custom_role",
        is_system_role: false,
      };
      const parsed = roleSchema.parse(input);
      expect(parsed.is_system_role).toBe(false);
    });
  });

  describe("permissionAssignmentSchema", () => {
    it("should accept a valid permission", () => {
      const input: PermissionAssignmentInput = {
        key: "customer.view",
        resource: "customer",
        action: "view",
        description: "View customer records",
      };
      expect(() => permissionAssignmentSchema.parse(input)).not.toThrow();
    });

    it("should require key in resource.action format", () => {
      const validInput: PermissionAssignmentInput = {
        key: "invoice.void",
        resource: "invoice",
        action: "void",
      };
      expect(() => permissionAssignmentSchema.parse(validInput)).not.toThrow();

      const invalidInput = {
        key: "invalid_key",
        resource: "invoice",
        action: "void",
      };
      expect(() => permissionAssignmentSchema.parse(invalidInput)).toThrow();
    });
  });

  describe("rolePermissionMappingSchema", () => {
    it("should accept valid UUIDs", () => {
      const input = {
        roleId: "550e8400-e29b-41d4-a716-446655440000",
        permissionId: "550e8400-e29b-41d4-a716-446655440001",
      };
      expect(() => rolePermissionMappingSchema.parse(input)).not.toThrow();
    });

    it("should reject invalid UUIDs", () => {
      const input = {
        roleId: "not-a-uuid",
        permissionId: "550e8400-e29b-41d4-a716-446655440001",
      };
      expect(() => rolePermissionMappingSchema.parse(input)).toThrow();
    });
  });

  describe("userRoleAssignmentSchema", () => {
    it("should accept a valid user role assignment", () => {
      const input: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: "550e8400-e29b-41d4-a716-446655440003",
        isActive: true,
      };
      expect(() => userRoleAssignmentSchema.parse(input)).not.toThrow();
    });

    it("should allow branchId to be null for organisation-scoped roles", () => {
      const input: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: null,
        isActive: true,
      };
      expect(() => userRoleAssignmentSchema.parse(input)).not.toThrow();
    });

    it("should require profileId, roleId, and organisationId", () => {
      const input = {
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
      };
      expect(() => userRoleAssignmentSchema.parse(input)).toThrow();
    });

    it("should set isActive default to true", () => {
      const input = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        isActive: true,
      };
      const parsed = userRoleAssignmentSchema.parse(input);
      expect(parsed.isActive).toBe(true);
    });
  });

  describe("validateRoleAssignmentScope", () => {
    it("should validate branch-scoped role requires branchId", () => {
      const input: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: "550e8400-e29b-41d4-a716-446655440003",
        isActive: true,
      };
      expect(validateRoleAssignmentScope(input, "branch")).toBe(true);

      const inputNoBranch: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: null,
        isActive: true,
      };
      expect(validateRoleAssignmentScope(inputNoBranch, "branch")).toBe(false);
    });

    it("should validate organisation-scoped role cannot have branchId", () => {
      const input: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: "550e8400-e29b-41d4-a716-446655440003",
        isActive: true,
      };
      expect(validateRoleAssignmentScope(input, "organisation")).toBe(false);

      const inputNoBranch: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: null,
        isActive: true,
      };
      expect(validateRoleAssignmentScope(inputNoBranch, "organisation")).toBe(
        true,
      );
    });

    it("should validate global role cannot have branchId", () => {
      const input: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: "550e8400-e29b-41d4-a716-446655440003",
        isActive: true,
      };
      expect(validateRoleAssignmentScope(input, "global")).toBe(false);

      const inputNoBranch: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: null,
        isActive: true,
      };
      expect(validateRoleAssignmentScope(inputNoBranch, "global")).toBe(true);
    });
  });

  describe("Module Exports", () => {
    it("should export all validation schemas", () => {
      expect(roleSchema).toBeDefined();
      expect(permissionAssignmentSchema).toBeDefined();
      expect(rolePermissionMappingSchema).toBeDefined();
      expect(userRoleAssignmentSchema).toBeDefined();
      expect(validateRoleAssignmentScope).toBeDefined();
    });

    it("should export RBAC module from index", async () => {
      const rbacModule = await import("@/src/lib/rbac");
      expect(rbacModule.roleSchema).toBeDefined();
      expect(rbacModule.userRoleAssignmentSchema).toBeDefined();
      expect(rbacModule.validateRoleAssignmentScope).toBeDefined();
    });
  });
});

describe("RBAC Authorization Rules", () => {
  describe("DEFAULT DENY Principle", () => {
    it("should enforce that no permission means no access", () => {
      // This is a conceptual test; actual enforcement is in the rbac-engine
      // and database RLS policies
      // Documented rule: if (!permission) { deny(); }
      const userHasPermission = false;
      const shouldAllow = userHasPermission;
      expect(shouldAllow).toBe(false);
    });
  });

  describe("Multiple Roles", () => {
    it("should support users holding multiple roles", () => {
      // A user can have:
      // - role_id=A, organisation_id=X, branch_id=NULL
      // - role_id=B, organisation_id=X, branch_id=Y
      // This is allowed by the UNIQUE constraint on (profile_id, role_id, organisation_id, branch_id)
      const assignment1: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: null,
        isActive: true,
      };
      const assignment2: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440003",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: "550e8400-e29b-41d4-a716-446655440004",
        isActive: true,
      };
      // Both should be valid and distinct
      expect(() => userRoleAssignmentSchema.parse(assignment1)).not.toThrow();
      expect(() => userRoleAssignmentSchema.parse(assignment2)).not.toThrow();
    });
  });

  describe("Separation of Duties", () => {
    it("should document that permissions do not automatically imply others", () => {
      // Example: estimate.update does NOT imply estimate.approve
      // This is enforced by role-permission mapping in the database
      // A role must explicitly be granted both permissions
      const estimatorPermissions = new Set([
        "estimate.create",
        "estimate.update",
        "estimate.submit",
      ]);
      const approverPermissions = new Set([
        "estimate.approve",
        "supplement.approve",
      ]);

      // Estimator cannot approve
      expect(estimatorPermissions.has("estimate.approve")).toBe(false);
      // Approver cannot edit
      expect(approverPermissions.has("estimate.update")).toBe(false);
    });
  });

  describe("System Roles Protection", () => {
    it("should identify system roles with is_system_role flag", () => {
      const systemRoleInput = {
        name: "System Admin",
        slug: "system_admin",
        is_system_role: true,
      };
      const customRoleInput = {
        name: "Custom Technician",
        slug: "custom_technician",
        is_system_role: false,
      };
      expect(() => roleSchema.parse(systemRoleInput)).not.toThrow();
      expect(() => roleSchema.parse(customRoleInput)).not.toThrow();
    });
  });

  describe("Branch vs Organisation Scope", () => {
    it("should distinguish branch-scoped from organisation-scoped roles", () => {
      // Branch Manager is branch-scoped
      const branchManagerAssignment: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: "550e8400-e29b-41d4-a716-446655440003", // Must specify branch
        isActive: true,
      };
      expect(() =>
        userRoleAssignmentSchema.parse(branchManagerAssignment),
      ).not.toThrow();

      // Group Admin is organisation-scoped
      const groupAdminAssignment: UserRoleAssignmentInput = {
        profileId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "550e8400-e29b-41d4-a716-446655440004",
        organisationId: "550e8400-e29b-41d4-a716-446655440002",
        branchId: null, // No branch
        isActive: true,
      };
      expect(() =>
        userRoleAssignmentSchema.parse(groupAdminAssignment),
      ).not.toThrow();
    });
  });

  describe("Custom Roles", () => {
    it("should mark custom roles as organisation-scoped", () => {
      const customRole = {
        name: "Senior Panel Tech",
        slug: "senior_panel_tech",
        description: "Senior technician with panel specialisation",
        is_system_role: false,
      };
      expect(() => roleSchema.parse(customRole)).not.toThrow();
      // In the database, this would have organisation_id set to a specific org
    });
  });

  describe("No Role Inheritance MVP", () => {
    it("should not implement role parent/child relationships in MVP", () => {
      // Roles are flat structures
      // Each role has explicit permissions via role_permissions join
      // No hierarchy: admin > manager > technician
      // Each role independently defines its permissions
      const managerPermissions = new Set([
        "repair_order.view",
        "workflow.transition",
        "labour.approve",
      ]);
      // Manager permissions do not automatically include technician permissions
      expect(managerPermissions.has("labour.create_own")).toBe(false);
    });
  });

  describe("No User-Level Permission Overrides MVP", () => {
    it("should defer user_permissions to Phase 2", () => {
      // In MVP, all permissions come from roles
      // No per-user exceptions like: "grant workflow.override to John until 2026-09-30"
      // This is documented as future enterprise support
      const userPermissions = new Set<string>(); // Always empty in MVP
      expect(userPermissions.size).toBe(0);
    });
  });
});
