import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/repair-orders/[id]/route";
import { AuthenticationRequiredError } from "@/src/lib/auth/session";
import { requireAuthenticatedUser } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/auth/server";
import { assertPermission } from "@/src/server/services/rbac-engine";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";

vi.mock("@/src/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/auth/server")>(
    "@/src/lib/auth/server",
  );

  return {
    ...actual,
    createServerSupabaseClient: vi.fn(),
  };
});

vi.mock("@/src/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/auth/session")>(
    "@/src/lib/auth/session",
  );

  return {
    ...actual,
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@/src/server/services/tenant-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/src/server/services/tenant-context")
  >("@/src/server/services/tenant-context");

  return {
    ...actual,
    resolveTenantContext: vi.fn(),
    assertTenantMembership: vi.fn(),
  };
});

vi.mock("@/src/server/services/rbac-engine", async () => {
  const actual = await vi.importActual<
    typeof import("@/src/server/services/rbac-engine")
  >("@/src/server/services/rbac-engine");

  return {
    ...actual,
    assertPermission: vi.fn(),
  };
});

function buildScopedRowQuery(
  row: Record<string, unknown> | null,
  expectedOrganisationId: string,
  expectedBranchId: string,
) {
  const seen: Record<string, string> = {};

  const eq = vi.fn((column: string, value: string) => {
    seen[column] = value;

    if (column === "id" || column === "organisation_id") {
      return { eq };
    }

    if (column === "branch_id") {
      return { eq, is };
    }

    return {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  const is = vi.fn((column: string, value: null) => {
    const matches =
      row !== null &&
      seen.id === row.id &&
      row.organisation_id === expectedOrganisationId &&
      row.branch_id === expectedBranchId &&
      seen.organisation_id === expectedOrganisationId &&
      seen.branch_id === expectedBranchId &&
      row[column] === value;

    return {
      maybeSingle: vi
        .fn()
        .mockResolvedValue(
          matches ? { data: row, error: null } : { data: null, error: null },
        ),
    };
  });

  return { eq, is };
}

describe("Repair order read route", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  const branchA1 = "33333333-3333-4333-8333-333333333333";
  const branchB1 = "55555555-5555-4555-8555-555555555555";
  const userId = "66666666-6666-4666-8666-666666666666";
  const repairOrderId = "77777777-7777-4777-8777-777777777777";
  const repairOrderIdInOrgB = "88888888-8888-4888-8888-888888888888";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        request_id: expect.any(String),
      },
    });
  });

  it("rejects authenticated access when tenant context is missing or invalid", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "organisationId and branchId query parameters are required.",
        request_id: expect.any(String),
      },
    });
  });

  it("returns a repair order when the user is authenticated, in-scope, and permitted", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);

    const row = {
      id: repairOrderId,
      organisation_id: orgA,
      branch_id: branchA1,
      ro_number: "RO-1001",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      archived_at: null,
    };

    const query = buildScopedRowQuery(row, orgA, branchA1);

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as never);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: row });
    expect(query.eq).toHaveBeenCalledWith("id", repairOrderId);
    expect(query.eq).toHaveBeenCalledWith("organisation_id", orgA);
    expect(query.eq).toHaveBeenCalledWith("branch_id", branchA1);
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("rejects a request when the user lacks repair_order.view permission", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockRejectedValue(
      new Error("User lacks permission 'repair_order.view'"),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
        request_id: expect.any(String),
      },
    });
  });

  it("rejects a legitimate Org A member attempting to fetch a row that exists in Org B", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);

    const rowInOrgB = {
      id: repairOrderIdInOrgB,
      organisation_id: orgB,
      branch_id: branchB1,
      ro_number: "RO-2001",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      archived_at: null,
    };
    const query = buildScopedRowQuery(rowInOrgB, orgA, branchA1);

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as never);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderIdInOrgB}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderIdInOrgB }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Repair order not found.",
        request_id: expect.any(String),
      },
    });
    expect(query.eq).toHaveBeenCalledWith("id", repairOrderIdInOrgB);
    expect(query.eq).toHaveBeenCalledWith("organisation_id", orgA);
    expect(query.eq).toHaveBeenCalledWith("branch_id", branchA1);
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("rejects cross-branch access inside the same organisation", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);

    const query = buildScopedRowQuery(null, orgA, branchA1);

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as never);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Repair order not found.",
        request_id: expect.any(String),
      },
    });
    expect(query.eq).toHaveBeenCalledWith("id", repairOrderId);
    expect(query.eq).toHaveBeenCalledWith("organisation_id", orgA);
    expect(query.eq).toHaveBeenCalledWith("branch_id", branchA1);
  });

  it("returns 404 when the requested repair order is missing in the same tenant", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);

    const query = buildScopedRowQuery(null, orgA, branchA1);

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as never);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Repair order not found.",
        request_id: expect.any(String),
      },
    });
    expect(query.eq).toHaveBeenCalledWith("id", repairOrderId);
    expect(query.eq).toHaveBeenCalledWith("organisation_id", orgA);
    expect(query.eq).toHaveBeenCalledWith("branch_id", branchA1);
  });

  it("validates the route requires a real UUID id path param", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/not-a-uuid?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid repair order ID.",
        request_id: expect.any(String),
      },
    });
  });

  it("does not return an archived repair order", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);

    const archivedRow = {
      id: repairOrderId,
      organisation_id: orgA,
      branch_id: branchA1,
      ro_number: "RO-1001",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      archived_at: "2026-01-03T00:00:00Z",
    };
    const query = buildScopedRowQuery(archivedRow, orgA, branchA1);

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as never);

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders/${repairOrderId}?organisationId=${orgA}&branchId=${branchA1}`,
      ),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Repair order not found.",
        request_id: expect.any(String),
      },
    });
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
  });
});
