import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/v1/repair-orders/[id]/route";
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
  customer_id: string | null;
  vehicle_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function buildSessionLookup(row: RepairOrderRow | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnValue({ eq, maybeSingle });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from };

  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);

  return { client, from, select, eq, maybeSingle };
}

function buildAdminUpdate(result: {
  data: RepairOrderRow | null;
  error: { code?: string; message?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const scopedQuery = {
    eq: vi.fn().mockReturnThis(),
    select,
  };
  const update = vi.fn().mockReturnValue(scopedQuery);
  const from = vi.fn().mockReturnValue({ update });
  const client = { from };

  vi.mocked(createAdminSupabaseClient).mockResolvedValue(client as never);

  return { client, from, update, scopedQuery, select, single };
}

describe("Repair order update route", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  const branchA1 = "33333333-3333-4333-8333-333333333333";
  const branchB1 = "55555555-5555-4555-8555-555555555555";
  const userId = "66666666-6666-4666-8666-666666666666";
  const repairOrderId = "77777777-7777-4777-8777-777777777777";
  const customerId = "88888888-8888-4888-8888-888888888888";
  const vehicleId = "99999999-9999-4999-8999-999999999999";

  const existingRow: RepairOrderRow = {
    id: repairOrderId,
    organisation_id: orgA,
    branch_id: branchA1,
    ro_number: "RO-1001",
    status: "intake",
    customer_id: null,
    vehicle_id: null,
    created_by: userId,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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

  function request(body: unknown, id = repairOrderId) {
    return new Request(`http://localhost/api/v1/repair-orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await PATCH(request({ ro_number: "RO-1002" }), {
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

  it("rejects a missing row without calling the admin client", async () => {
    buildSessionLookup(null);

    const response = await PATCH(request({ ro_number: "RO-1002" }), {
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

  it("rejects an invalid UUID path parameter", async () => {
    const response = await PATCH(
      request({ ro_number: "RO-1002" }, "not-a-uuid"),
      {
        params: Promise.resolve({ id: "not-a-uuid" }),
      },
    );

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

  it("rejects attempts to modify immutable fields", async () => {
    const response = await PATCH(
      request({
        organisation_id: orgB,
        branch_id: branchB1,
        status: "painting",
      }),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid repair order update payload.",
        request_id: expect.any(String),
        details: expect.any(Object),
      },
    });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects an empty update payload", async () => {
    const response = await PATCH(request({}), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid repair order update payload.",
        request_id: expect.any(String),
        details: expect.any(Object),
      },
    });
  });

  it("rejects a user who is not a member of the existing row tenant", async () => {
    buildSessionLookup(existingRow);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgA,
      branchId: branchA1,
    });
    vi.mocked(assertTenantMembership).mockRejectedValue(
      new Error(
        "The authenticated user is not a member of the requested organisation or branch.",
      ),
    );

    const response = await PATCH(request({ ro_number: "RO-1002" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(403);
    expect(resolveTenantContext).toHaveBeenCalledWith({
      organisationId: orgA,
      branchId: branchA1,
    });
    expect(assertPermission).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects a request when the user lacks repair_order.update permission", async () => {
    buildSessionLookup(existingRow);
    vi.mocked(assertPermission).mockRejectedValue(
      new Error("User lacks permission 'repair_order.update'"),
    );

    const response = await PATCH(request({ ro_number: "RO-1002" }), {
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

  it("updates only editable fields using the existing row tenant scope", async () => {
    buildSessionLookup(existingRow);
    const updatedRow = {
      ...existingRow,
      ro_number: "RO-1002",
      customer_id: customerId,
      vehicle_id: vehicleId,
    };
    const query = buildAdminUpdate({ data: updatedRow, error: null });

    const response = await PATCH(
      request({
        ro_number: "RO-1002",
        customer_id: customerId,
        vehicle_id: vehicleId,
      }),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: updatedRow });
    expect(createAdminSupabaseClient).toHaveBeenCalledOnce();
    expect(query.update).toHaveBeenCalledWith({
      ro_number: "RO-1002",
      customer_id: customerId,
      vehicle_id: vehicleId,
    });
    expect(query.scopedQuery.eq).toHaveBeenNthCalledWith(
      1,
      "id",
      repairOrderId,
    );
    expect(query.scopedQuery.eq).toHaveBeenNthCalledWith(
      2,
      "organisation_id",
      orgA,
    );
    expect(query.scopedQuery.eq).toHaveBeenNthCalledWith(
      3,
      "branch_id",
      branchA1,
    );
    expect(assertPermission).toHaveBeenCalledWith(
      userId,
      "repair_order.update",
      orgA,
      branchA1,
    );
  });

  it("returns 409 for a duplicate ro_number", async () => {
    buildSessionLookup(existingRow);
    const query = buildAdminUpdate({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const response = await PATCH(request({ ro_number: "RO-2001" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "DUPLICATE",
        message:
          "A repair order with this RO number already exists in the organisation.",
        request_id: expect.any(String),
      },
    });
    expect(query.update).toHaveBeenCalledWith({ ro_number: "RO-2001" });
  });

  it("rejects a cross-tenant target before any update even when permission is granted elsewhere", async () => {
    const rowInOrgB = {
      ...existingRow,
      organisation_id: orgB,
      branch_id: branchB1,
    };
    buildSessionLookup(rowInOrgB);
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgB,
      branchId: branchB1,
    });
    vi.mocked(assertTenantMembership).mockRejectedValue(
      new Error(
        "The authenticated user is not a member of the requested organisation or branch.",
      ),
    );

    const response = await PATCH(
      request({
        ro_number: "RO-2001",
      }),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(403);
    expect(resolveTenantContext).toHaveBeenCalledWith({
      organisationId: orgB,
      branchId: branchB1,
    });
    expect(assertPermission).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
