import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as currentOrganisationRoute } from "@/app/api/v1/tenant-context/current-organisation/route";
import { createServerSupabaseClient } from "@/src/lib/auth/server";

vi.mock("@/src/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/auth/server")>(
    "@/src/lib/auth/server",
  );

  return {
    ...actual,
    createServerSupabaseClient: vi.fn(),
  };
});

function mockTenantSession(
  session: unknown,
  organisationMemberships: Array<Record<string, string>> = [],
  branchMemberships: Array<Record<string, string>> = [],
  sessionError: unknown = null,
) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user:
            session && typeof session === "object" && "user" in session
              ? session.user
              : null,
        },
        error: sessionError,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
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

  vi.mocked(createServerSupabaseClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  );
}

function mockSessionLookupFailure(error: Error) {
  const client = {
    auth: {
      getUser: vi.fn().mockRejectedValue(error),
    },
  };

  vi.mocked(createServerSupabaseClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  );
}

async function postSelection(organisationId: unknown) {
  return currentOrganisationRoute(
    new Request("http://localhost/api/v1/tenant-context/current-organisation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisationId }),
    }),
  );
}

describe("Current organisation selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request with no authenticated session", async () => {
    mockTenantSession(null);

    const response = await postSelection(
      "11111111-1111-4111-8111-111111111111",
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

  it("rejects a request when session lookup throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSessionLookupFailure(new Error("Session lookup failed"));

    const response = await postSelection(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        request_id: expect.any(String),
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error getting authenticated user:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("rejects a malformed organisation ID before membership lookup", async () => {
    const from = vi.fn();
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from,
    } as never);

    const response = await postSelection("not-a-uuid");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Organisation ID must be a valid UUID.",
        request_id: expect.any(String),
      },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a valid organisation when the user is not a member", async () => {
    mockTenantSession(
      {
        user: { id: "33333333-3333-4333-8333-333333333333" },
      },
      [{ organisation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    );

    const response = await postSelection(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message:
          "The authenticated user is not a member of the requested organisation or branch.",
        request_id: expect.any(String),
      },
    });
  });

  it("allows an authenticated member to select an organisation", async () => {
    mockTenantSession(
      {
        user: { id: "22222222-2222-4222-8222-222222222222" },
      },
      [{ organisation_id: "11111111-1111-4111-8111-111111111111" }],
    );

    const response = await postSelection(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organisationId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns organisation context without introducing branch selection", async () => {
    mockTenantSession(
      {
        user: { id: "22222222-2222-4222-8222-222222222222" },
      },
      [{ organisation_id: "11111111-1111-4111-8111-111111111111" }],
    );

    const response = await postSelection(
      "11111111-1111-4111-8111-111111111111",
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      organisationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(payload).not.toHaveProperty("branchId");
  });
});
