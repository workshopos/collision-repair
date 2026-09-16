import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/repair-orders/route";
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

function buildListQuery(rows: RepairOrderRow[]) {
  const filters: Record<string, string | null> = {};
  const query = {
    eq: vi.fn((column: string, value: string) => {
      filters[column] = value;
      return query;
    }),
    is: vi.fn((column: string, value: string | null) => {
      filters[column] = value;
      return query;
    }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(async (from: number, to: number) => {
      const filteredRows = rows
        .filter((row) =>
          Object.entries(filters).every(
            ([column, value]) => row[column as keyof RepairOrderRow] === value,
          ),
        )
        .sort((left, right) => {
          const createdAtOrder = right.created_at.localeCompare(
            left.created_at,
          );
          return createdAtOrder || right.id.localeCompare(left.id);
        });

      return {
        data: filteredRows.slice(from, to + 1),
        count: filteredRows.length,
        error: null,
      };
    }),
  };

  return query;
}

describe("Repair order list route", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  const branchA1 = "33333333-3333-4333-8333-333333333333";
  const branchA2 = "44444444-4444-4444-8444-444444444444";
  const branchB1 = "55555555-5555-4555-8555-555555555555";
  const userId = "66666666-6666-4666-8666-666666666666";

  const rows: RepairOrderRow[] = [
    {
      id: "77777777-7777-4777-8777-777777777777",
      organisation_id: orgA,
      branch_id: branchA1,
      ro_number: "RO-A1-002",
      status: "painting",
      created_by: userId,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      archived_at: null,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      organisation_id: orgA,
      branch_id: branchA1,
      ro_number: "RO-A1-001",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      archived_at: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      organisation_id: orgA,
      branch_id: branchA1,
      ro_number: "RO-A1-ARCHIVED",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-05T00:00:00Z",
      updated_at: "2026-01-05T00:00:00Z",
      archived_at: "2026-01-06T00:00:00Z",
    },
    {
      id: "99999999-9999-4999-8999-999999999999",
      organisation_id: orgA,
      branch_id: branchA2,
      ro_number: "RO-A2-001",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-01-03T00:00:00Z",
      archived_at: null,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organisation_id: orgB,
      branch_id: branchB1,
      ro_number: "RO-B1-001",
      status: "intake",
      created_by: userId,
      created_at: "2026-01-04T00:00:00Z",
      updated_at: "2026-01-04T00:00:00Z",
      archived_at: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  function configureRows(queryRows = rows) {
    const query = buildListQuery(queryRows);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as never);
    return query;
  }

  it("rejects unauthenticated access", async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(
      new AuthenticationRequiredError(),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}`,
      ),
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

  it("rejects authenticated access when tenant context is missing", async () => {
    const response = await GET(
      new Request(`http://localhost/api/v1/repair-orders?branchId=${branchA1}`),
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

  it("rejects a request when the user lacks repair_order.view permission", async () => {
    vi.mocked(assertPermission).mockRejectedValue(
      new Error("User lacks permission 'repair_order.view'"),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}`,
      ),
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

  it("returns only rows from the requested organisation and branch", async () => {
    const query = configureRows();

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((row: RepairOrderRow) => row.id)).toEqual([
      rows[0].id,
      rows[1].id,
    ]);
    expect(body.data).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ id: rows[2].id }),
        expect.objectContaining({ id: rows[3].id }),
        expect.objectContaining({ id: rows[4].id }),
      ]),
    );
    expect(body.meta).toEqual({ page: 1, page_size: 25, total: 2 });
    expect(query.eq).toHaveBeenCalledWith("organisation_id", orgA);
    expect(query.eq).toHaveBeenCalledWith("branch_id", branchA1);
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("applies the requested page size and never exceeds the maximum page size", async () => {
    const query = configureRows();

    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}&page=2&page_size=1`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((row: RepairOrderRow) => row.id)).toEqual([
      rows[1].id,
    ]);
    expect(body.meta).toEqual({ page: 2, page_size: 1, total: 2 });
    expect(query.range).toHaveBeenCalledWith(1, 1);
  });

  it("rejects page_size=0", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}&page_size=0`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects page_size=101", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}&page_size=101`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects page_size=abc", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}&page_size=abc`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects page=-1", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}&page=-1`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects page=0", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/v1/repair-orders?organisationId=${orgA}&branchId=${branchA1}&page=0`,
      ),
    );

    expect(response.status).toBe(400);
  });
});
