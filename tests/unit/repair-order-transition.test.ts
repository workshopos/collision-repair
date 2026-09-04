import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/repair-orders/[id]/transition/route";
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

// NOTE ON WHAT THIS FILE DOES AND DOESN'T PROVE:
// These tests mock the Supabase RPC call itself, same as the previous
// version of this file. That's appropriate for a UNIT test of the route
// handler (auth, validation, permission wiring, error-code mapping) — but
// it means these tests CANNOT catch bugs in the actual SQL transition
// logic (sequential ordering, rework rules, tenant-scope check inside the
// RPC). That logic needs a separate integration test that calls the real
// RPC against a real Postgres instance (mirroring the approach used in
// tests/integration/rls-tenant-isolation.test.ts). Treat this file as
// "does the route call the RPC correctly", not "does the state machine
// work correctly".

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
  lifecycle_status: string;
  primary_repair_stage: string | null;
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

function buildRpc(result: {
  data?: RepairOrderRow | null;
  error?: { code?: string; message?: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(result);
  vi.mocked(createAdminSupabaseClient).mockResolvedValue({ rpc } as never);
  return { rpc };
}

describe("Repair order transition route", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const branchA1 = "33333333-3333-4333-8333-333333333333";
  const userId = "66666666-6666-4666-8666-666666666666";
  const repairOrderId = "77777777-7777-4777-8777-777777777777";

  const intakeRow: RepairOrderRow = {
    id: repairOrderId,
    organisation_id: orgA,
    branch_id: branchA1,
    ro_number: "RO-1001",
    lifecycle_status: "intake",
    primary_repair_stage: null,
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

  function request(body: unknown, id = repairOrderId) {
    return new Request(
      `http://localhost/api/v1/repair-orders/${id}/transition`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  it("rejects an invalid UUID path parameter", async () => {
    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid repair order ID" });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing row before any admin write is attempted", async () => {
    buildLookup(null);

    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Repair order not found" });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects an unknown action", async () => {
    buildLookup(intakeRow);

    const response = await POST(request({ action: "teleport_to_finished" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid repair order transition payload",
    });
  });

  it("rejects reject_to_stage without a reason", async () => {
    buildLookup({
      ...intakeRow,
      lifecycle_status: "in_repair",
      primary_repair_stage: "painting",
    });

    const response = await POST(
      request({ action: "reject_to_stage", target_stage: "panel_beating" }),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid repair order transition payload",
    });
  });

  it("rejects a request when the user lacks repair_order.transition permission", async () => {
    buildLookup(intakeRow);
    vi.mocked(assertPermission).mockRejectedValue(
      new Error("User lacks permission 'repair_order.transition'"),
    );

    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("requires repair_order.cancel when transitioning via cancel", async () => {
    buildLookup(intakeRow);
    vi.mocked(assertPermission).mockImplementation(
      async (_userId, permission) => {
        if (permission === "repair_order.transition") return;
        throw new Error(`User lacks permission '${permission}'`);
      },
    );

    const response = await POST(request({ action: "cancel" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("requires repair_order.close when transitioning via complete", async () => {
    buildLookup({
      ...intakeRow,
      lifecycle_status: "in_repair",
      primary_repair_stage: "final_inspection",
    });
    vi.mocked(assertPermission).mockImplementation(
      async (_userId, permission) => {
        if (permission === "repair_order.transition") return;
        throw new Error(`User lacks permission '${permission}'`);
      },
    );

    const response = await POST(request({ action: "complete" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("accepts start_repair and calls the RPC with the new signature", async () => {
    buildLookup(intakeRow);
    buildRpc({
      data: {
        ...intakeRow,
        lifecycle_status: "in_repair",
        primary_repair_stage: "disassembly",
      },
      error: null,
    });

    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.primary_repair_stage).toBe("disassembly");

    const rpcClient = await vi.mocked(createAdminSupabaseClient).mock.results[0]
      ?.value;
    expect(rpcClient.rpc).toHaveBeenCalledWith("transition_repair_order", {
      p_repair_order_id: repairOrderId,
      p_action: "start_repair",
      p_actor_id: userId,
      p_organisation_id: orgA,
      p_branch_id: branchA1,
      p_target_stage: null,
      p_reason: null,
    });
  });

  it("accepts reject_to_stage with a reason and passes target_stage + reason through", async () => {
    buildLookup({
      ...intakeRow,
      lifecycle_status: "in_repair",
      primary_repair_stage: "painting",
    });
    buildRpc({
      data: {
        ...intakeRow,
        lifecycle_status: "in_repair",
        primary_repair_stage: "panel_beating",
      },
      error: null,
    });

    const response = await POST(
      request({
        action: "reject_to_stage",
        target_stage: "panel_beating",
        reason: "Paint adhesion failed inspection, panel needs rework",
      }),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(200);

    const rpcClient = await vi.mocked(createAdminSupabaseClient).mock.results[0]
      ?.value;
    expect(rpcClient.rpc).toHaveBeenCalledWith("transition_repair_order", {
      p_repair_order_id: repairOrderId,
      p_action: "reject_to_stage",
      p_actor_id: userId,
      p_organisation_id: orgA,
      p_branch_id: branchA1,
      p_target_stage: "panel_beating",
      p_reason: "Paint adhesion failed inspection, panel needs rework",
    });
  });

  it("maps a sequence-violation error from the RPC to 409", async () => {
    buildLookup({
      ...intakeRow,
      lifecycle_status: "in_repair",
      primary_repair_stage: "disassembly",
    });
    buildRpc({
      error: {
        code: "P0001",
        message:
          "Invalid transition: reject_to_stage target (parts_ordering) must be earlier than current stage (disassembly)",
      },
    });

    const response = await POST(
      request({
        action: "reject_to_stage",
        target_stage: "parts_ordering",
        reason: "test",
      }),
      { params: Promise.resolve({ id: repairOrderId }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Invalid repair order transition",
    });
  });

  it("maps a tenant-scope-mismatch error from the RPC to 409", async () => {
    buildLookup(intakeRow);
    buildRpc({
      error: {
        code: "P0001",
        message: "Repair order tenant scope does not match",
      },
    });

    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Repair order tenant scope does not match",
    });
  });

  it("maps a not-found error from the RPC (P0002) to 404", async () => {
    buildLookup(intakeRow);
    buildRpc({
      error: {
        code: "P0002",
        message: "repair_order ... not found",
      },
    });

    const response = await POST(request({ action: "start_repair" }), {
      params: Promise.resolve({ id: repairOrderId }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Repair order not found" });
  });
});
