import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertTenantMembership,
  enforceTenantContract,
  enforceTenantRequestBoundary,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { POST as tenantContextRoute } from "@/app/api/v1/tenant-context/route";
import { getCurrentUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/auth/server";

type MockUser = {
  id: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
};

type MockQueryResult = {
  data: Array<Record<string, string>> | null;
  error: null;
};

type MockMembershipClient = {
  from: (table: string) => {
    select: () => {
      eq: () => {
        eq: () => Promise<MockQueryResult>;
      };
    };
  };
};

function buildMembershipClient(
  organisationMemberships: Array<Record<string, string>>,
  branchMemberships: Array<Record<string, string>>,
): MockMembershipClient {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: async (): Promise<MockQueryResult> => ({
            data:
              table === "organisation_memberships"
                ? organisationMemberships
                : branchMemberships,
            error: null,
          }),
        }),
      }),
    }),
  };
}

vi.mock("@/src/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/src/lib/auth")>("@/src/lib/auth");

  return {
    ...actual,
    getCurrentUser: vi.fn(),
  };
});

vi.mock("@/src/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/auth/server")>(
    "@/src/lib/auth/server",
  );

  return {
    ...actual,
    createServerSupabaseClient: vi.fn(),
  };
});

describe("Tenant Foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should export tenant context utilities", async () => {
    const tenantModule = await import("@/src/lib/tenant");

    expect(tenantModule.tenantScopeSchema).toBeDefined();
    expect(typeof tenantModule.resolveCurrentTenantContext).toBe("function");
    expect(typeof tenantModule.requireTenantMembership).toBe("function");
  });

  it("should reject invalid tenant identifiers", async () => {
    const { tenantScopeSchema } = await import("@/src/lib/tenant");

    const invalid = tenantScopeSchema.safeParse({
      organisationId: "not-a-uuid",
      branchId: "also-not-a-uuid",
    });

    expect(invalid.success).toBe(false);
  });

  it("should accept valid tenant identifiers", async () => {
    const { tenantScopeSchema } = await import("@/src/lib/tenant");

    const valid = tenantScopeSchema.safeParse({
      organisationId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
    });

    expect(valid.success).toBe(true);
  });

  it("should reject missing organisation context instead of silently defaulting", async () => {
    await expect(resolveTenantContext({})).rejects.toThrow(
      /Organisation ID is required|Invalid tenant scope/i,
    );
  });

  it("should preserve the organisation and optional branch in the server contract", async () => {
    const context = await resolveTenantContext({
      organisationId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
    });

    expect(context.organisationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(context.branchId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("should require a valid organisation on membership assertion", async () => {
    await expect(assertTenantMembership({}, async () => true)).rejects.toThrow(
      /Organisation ID is required/i,
    );
  });

  it("should reject tenant-aware business logic when the tenant request is invalid", async () => {
    await expect(
      enforceTenantContract({}, async () => "should not reach business logic"),
    ).rejects.toThrow(/Organisation ID is required/i);
  });

  it("should allow tenant-aware business logic when the tenant request is valid", async () => {
    const scope = {
      organisationId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
    };

    const result = await enforceTenantContract(
      scope,
      async (tenant) => ({
        organisationId: tenant.organisationId,
        branchId: tenant.branchId,
        allowed: true,
      }),
      async (tenant) => tenant.organisationId === scope.organisationId,
    );

    expect(result).toEqual({
      organisationId: scope.organisationId,
      branchId: scope.branchId,
      allowed: true,
    });
  });

  it("should reject tenant-aware routes before business logic executes", async () => {
    await expect(
      enforceTenantRequestBoundary(
        {},
        async () => "should not reach business logic",
      ),
    ).rejects.toThrow(/Organisation ID is required/i);
  });

  it("should reject an invalid tenant request at the route boundary", async () => {
    const user: MockUser = {
      id: "11111111-1111-4111-8111-111111111111",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildMembershipClient(
        [{ organisation_id: "11111111-1111-4111-8111-111111111111" }],
        [
          {
            organisation_id: "11111111-1111-4111-8111-111111111111",
            branch_id: "22222222-2222-4222-8222-222222222222",
          },
        ],
      ) as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const response = await tenantContextRoute(
      new Request("http://localhost/api/v1/tenant-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/Organisation ID is required|Invalid/i);
  });

  it("should reject a syntactically valid request when the user is not a member", async () => {
    const user: MockUser = {
      id: "33333333-3333-4333-8333-333333333333",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildMembershipClient(
        [{ organisation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
        [],
      ) as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const response = await tenantContextRoute(
      new Request("http://localhost/api/v1/tenant-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: "11111111-1111-4111-8111-111111111111",
          branchId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/not a member/i);
  });

  it("should allow a valid tenant request through the route boundary", async () => {
    const user: MockUser = {
      id: "22222222-2222-4222-8222-222222222222",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildMembershipClient(
        [{ organisation_id: "11111111-1111-4111-8111-111111111111" }],
        [
          {
            organisation_id: "11111111-1111-4111-8111-111111111111",
            branch_id: "22222222-2222-4222-8222-222222222222",
          },
        ],
      ) as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const response = await tenantContextRoute(
      new Request("http://localhost/api/v1/tenant-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: "11111111-1111-4111-8111-111111111111",
          branchId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.organisationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.branchId).toBe("22222222-2222-4222-8222-222222222222");
  });
});
