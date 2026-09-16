import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/repair-orders/route";
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

function buildInsertClient(result: {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  const client = { from };

  vi.mocked(createAdminSupabaseClient).mockResolvedValue(client as never);

  return { client, from, insert, select, single };
}

describe("Repair order create route", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  const branchA1 = "33333333-3333-4333-8333-333333333333";
  const branchB1 = "55555555-5555-4555-8555-555555555555";
  const userId = "66666666-6666-4666-8666-666666666666";
  const repairOrderId = "77777777-7777-4777-8777-777777777777";

  const validPayload = {
    organisationId: orgA,
    branchId: branchA1,
    ro_number: "RO-1001",
    status: "intake",
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

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/repair-orders", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
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

  it("rejects an invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/repair-orders", {
        method: "POST",
        body: JSON.stringify({ ...validPayload, ro_number: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid repair order payload.",
        request_id: expect.any(String),
        details: expect.any(Object),
      },
    });
    expect(resolveTenantContext).not.toHaveBeenCalled();
  });

  it("rejects a request when the user lacks repair_order.create permission", async () => {
    vi.mocked(assertPermission).mockRejectedValue(
      new Error("User lacks permission 'repair_order.create'"),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/repair-orders", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

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

  it("creates a repair order with the validated scope and authenticated creator", async () => {
    const createdRow = {
      id: repairOrderId,
      ...validPayload,
      organisation_id: orgA,
      branch_id: branchA1,
      created_by: userId,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const query = buildInsertClient({ data: createdRow, error: null });

    const response = await POST(
      new Request("http://localhost/api/v1/repair-orders", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: createdRow });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).toHaveBeenCalledOnce();
    expect(query.insert).toHaveBeenCalledWith({
      organisation_id: orgA,
      branch_id: branchA1,
      ro_number: "RO-1001",
      lifecycle_status: "intake",
      primary_repair_stage: null,
      customer_id: null,
      vehicle_id: null,
      created_by: userId,
    });
    expect(assertPermission).toHaveBeenCalledWith(
      userId,
      "repair_order.create",
      orgA,
      branchA1,
    );
  });

  it("returns 409 for a duplicate ro_number", async () => {
    const query = buildInsertClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/repair-orders", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "DUPLICATE",
        message:
          "A repair order with this RO number already exists in the organisation.",
        request_id: expect.any(String),
      },
    });
    expect(query.insert).toHaveBeenCalledOnce();
  });

  it("rejects creation in an organisation and branch where the user is not a member", async () => {
    vi.mocked(resolveTenantContext).mockResolvedValue({
      organisationId: orgB,
      branchId: branchB1,
    });
    vi.mocked(assertTenantMembership).mockRejectedValue(
      new Error(
        "The authenticated user is not a member of the requested organisation or branch.",
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/repair-orders", {
        method: "POST",
        body: JSON.stringify({
          ...validPayload,
          organisationId: orgB,
          branchId: branchB1,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have access to this workspace.",
        request_id: expect.any(String),
      },
    });
    expect(assertPermission).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
