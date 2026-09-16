import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as currentBranchGet } from "@/app/api/v1/tenant-context/current-branch/route";
import { POST as switchBranch } from "@/app/api/v1/tenant-context/switch-branch/route";
import { createServerSupabaseClient } from "@/src/lib/auth/server";
import { ACTIVE_TENANT_CONTEXT_COOKIE } from "@/src/server/services/active-tenant-context";

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: {
    value: undefined as
      | { name: string; value: string; options?: Record<string, unknown> }
      | undefined,
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/src/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/auth/server")>(
    "@/src/lib/auth/server",
  );

  return {
    ...actual,
    createServerSupabaseClient: vi.fn(),
  };
});

const organisationA = "11111111-1111-4111-8111-111111111111";
const organisationC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const organisationX = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchB = "22222222-2222-4222-8222-222222222222";
const branchY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mockTenantSession(
  session: unknown,
  organisationMemberships: Array<Record<string, string>> = [],
  branchMemberships: Array<Record<string, string>> = [],
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
        error: null,
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

function activeMemberships(branchOrganisationId = organisationA) {
  return {
    organisationMemberships: [{ organisation_id: organisationA }],
    branchMemberships: [
      { organisation_id: branchOrganisationId, branch_id: branchB },
    ],
  };
}

async function postSwitch(organisationId: unknown, branchId: unknown) {
  return switchBranch(
    new Request("http://localhost/api/v1/tenant-context/switch-branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisationId, branchId }),
    }),
  );
}

function encodedContext(organisationId = organisationA, branchId = branchB) {
  return encodeURIComponent(JSON.stringify({ organisationId, branchId }));
}

describe("Branch switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.value = undefined;
    cookieStore.get.mockImplementation(() => cookieStore.value);
  });

  it("rejects a switch with no authenticated session", async () => {
    mockTenantSession(null);

    const response = await postSwitch(organisationA, branchB);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        request_id: expect.any(String),
      },
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects a switch when session lookup throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSessionLookupFailure(new Error("Session lookup failed"));

    const response = await postSwitch(organisationA, branchB);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        request_id: expect.any(String),
      },
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("rejects malformed organisation or branch identifiers", async () => {
    const from = vi.fn();
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from,
    } as never);

    const response = await postSwitch("not-a-uuid", branchB);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Organisation ID must be a valid UUID.",
        request_id: expect.any(String),
      },
    });
    expect(from).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects a user who lacks membership in the requested branch", async () => {
    mockTenantSession(
      { user: { id: "33333333-3333-4333-8333-333333333333" } },
      [{ organisation_id: organisationA }],
      [],
    );

    const response = await postSwitch(organisationA, branchB);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message:
          "The authenticated user is not a member of the requested organisation or branch.",
        request_id: expect.any(String),
      },
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects a branch belonging to another organisation despite individual memberships", async () => {
    mockTenantSession(
      { user: { id: "44444444-4444-4444-8444-444444444444" } },
      activeMemberships(organisationC).organisationMemberships,
      activeMemberships(organisationC).branchMemberships,
    );

    const response = await postSwitch(organisationA, branchB);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message:
          "The authenticated user is not a member of the requested organisation or branch.",
        request_id: expect.any(String),
      },
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("sets an unsigned active-context cookie after an authorized switch", async () => {
    const memberships = activeMemberships();
    mockTenantSession(
      { user: { id: "55555555-5555-4555-8555-555555555555" } },
      memberships.organisationMemberships,
      memberships.branchMemberships,
    );

    const response = await postSwitch(organisationA, branchB);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organisationId: organisationA,
      branchId: branchB,
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      ACTIVE_TENANT_CONTEXT_COOKIE,
      encodedContext(),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      },
    );
  });

  it("serves the active branch through the real consumer route", async () => {
    cookieStore.value = {
      name: ACTIVE_TENANT_CONTEXT_COOKIE,
      value: encodedContext(),
    };
    const memberships = activeMemberships();
    mockTenantSession(
      { user: { id: "66666666-6666-4666-8666-666666666666" } },
      memberships.organisationMemberships,
      memberships.branchMemberships,
    );

    const response = await currentBranchGet();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organisationId: organisationA,
      branchId: branchB,
    });
  });

  it("rejects a tampered active cookie that claims a different organisation or branch", async () => {
    cookieStore.value = {
      name: ACTIVE_TENANT_CONTEXT_COOKIE,
      value: encodedContext(organisationX, branchY),
    };
    mockTenantSession(
      { user: { id: "77777777-7777-4777-8777-777777777777" } },
      [{ organisation_id: organisationA }],
      [{ organisation_id: organisationA, branch_id: branchB }],
    );

    const response = await currentBranchGet();

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

  it("rejects a stale active cookie after membership changes", async () => {
    cookieStore.value = {
      name: ACTIVE_TENANT_CONTEXT_COOKIE,
      value: encodedContext(),
    };
    mockTenantSession(
      { user: { id: "88888888-8888-4888-8888-888888888888" } },
      [{ organisation_id: organisationA }],
      [],
    );

    const response = await currentBranchGet();

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
});
