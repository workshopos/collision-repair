import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/v1/repair-orders/[id]/route";
import { AuthenticationRequiredError } from "@/src/lib/auth/session";
import { requireAuthenticatedUser } from "@/src/lib/auth/session";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/src/lib/auth/server";
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
    createAdminSupabaseClient: vi.fn(),
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

type User = Awaited<ReturnType<typeof requireAuthenticatedUser>>;

type RepairOrderRow = {
  id: string;
  organisation_id: string;
  branch_id: string;
  ro_number: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

function buildLookup(row: RepairOrderRow | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnValue({ eq, maybeSingle });
  const from = vi.fn().mockReturnValue({ select });
  vi.mocked(createServerSupabaseClient).mockResolvedValue({ from } as never);
  return { from, select, eq, maybeSingle };
}

function buildArchiveUpdate(result: {
  data: RepairOrderRow | null;
  error: { code?: string; message?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const updateQuery = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select,
  };
  const update = vi.fn().mockReturnValue(updateQuery);
  const from = vi.fn().mockReturnValue({ update });
  vi.mocked(createAdminSupabaseClient).mockResolvedValue({ from } as never);
  return { from, update, updateQuery, select, single };
}

describe("Repair order archive route", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  const branchA1 = "33333333-3333-4333-8333-333333333333";
  const branchB1 = "55555555-5555-4555-8555-555555555555";
  const userId = "66666666-6666-4666-8666-666666666666";
  const repairOrderId = "77777777-7777-4777-8777-777777777777";

  const existingRow: RepairOrderRow = {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: userId,
    } as User);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertPermission).mockResolvedValue(undefined);
  });

  function request(id = repairOrderId) {
    return new Request(`http://localhost/api/v1/repair-orders/${id}`, {
      method: "DELETE",
    });
  }

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        request_id: expect.any(String),
      },
    });
  });

  it("rejects an invalid UUID path parameter", async () => {
    const response = await DELETE(request("not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid repair order ID.",
        request_id: expect.any(String),
      },
    });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing row without calling the admin client", async () => {
    buildLookup(null);

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Repair order not found.",
        request_id: expect.any(String),
      },
    });
    expect(resolveTenantContext).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant target before archive", async () => {
    const rowInOrgB = {
      ...existingRow,
      organisation_id: orgB,
      branch_id: branchB1,
    };
    buildLookup(rowInOrgB);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgB,
      branchId: branchB1,
    });
    vi.mocked(assertTenantMembership).mockRejectedValue(
      new Error(
        "The authenticated user is not a member of the requested organisation or branch.",
      ),
    );

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(403);
    expect(resolveTenantContext).toHaveBeenCalledWith({
      organisationId: orgB,
      branchId: branchB1,
    });
    expect(assertPermission).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects a request when the user lacks repair_order.archive permission", async () => {
    buildLookup(existingRow);
    vi.mocked(assertPermission).mockRejectedValue(
      new Error("User lacks permission 'repair_order.archive'"),
    );

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
        request_id: expect.any(String),
      },
    });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("archives the existing row using its validated tenant scope", async () => {
    buildLookup(existingRow);
    const archivedRow = {
      ...existingRow,
      archived_at: "2026-01-03T00:00:00.000Z",
    };
    const query = buildArchiveUpdate({ data: archivedRow, error: null });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));
    const response = await DELETE(request(), {
      params: Promise.resolve({ id: repairOrderId }),
    });
    vi.useRealTimers();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: archivedRow });
    expect(createAdminSupabaseClient).toHaveBeenCalledOnce();
    expect(query.update).toHaveBeenCalledWith({
      archived_at: "2026-01-03T00:00:00.000Z",
    });
    expect(query.updateQuery.eq).toHaveBeenNthCalledWith(
      1,
      "id",
      repairOrderId,
    );
    expect(query.updateQuery.eq).toHaveBeenNthCalledWith(
      2,
      "organisation_id",
      orgA,
    );
    expect(query.updateQuery.eq).toHaveBeenNthCalledWith(
      3,
      "branch_id",
      branchA1,
    );
    expect(query.updateQuery.is).toHaveBeenCalledWith("archived_at", null);
    expect(assertPermission).toHaveBeenCalledWith(
      userId,
      "repair_order.archive",
      orgA,
      branchA1,
    );
  });

  it("returns 404 for an already archived row", async () => {
    buildLookup({
      ...existingRow,
      archived_at: "2026-01-02T00:00:00Z",
    });

    const response = await DELETE(request(), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Repair order not found.",
        request_id: expect.any(String),
      },
    });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
