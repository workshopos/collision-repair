import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthenticatedLayout from "@/app/(authenticated)/layout";
import { createServerSupabaseClient } from "@/src/lib/auth/server";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { getEffectivePermissions } from "@/src/server/services/rbac-engine";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
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

vi.mock("@/src/server/services/active-tenant-context", () => ({
  readActiveTenantContext: vi.fn(),
}));

vi.mock("@/src/server/services/rbac-engine", () => ({
  getEffectivePermissions: vi.fn(),
}));

function mockSession(session: unknown, error: unknown = null) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user:
            session && typeof session === "object" && "user" in session
              ? session.user
              : null,
        },
        error,
      }),
    },
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

describe("Unauthenticated page redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readActiveTenantContext).mockResolvedValue({
      organisationId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
    });
    vi.mocked(getEffectivePermissions).mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      organisationId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
      permissions: new Set(),
      roleAssignments: [],
    });
  });

  it("redirects a request with no session to login", async () => {
    mockSession(null);

    await expect(AuthenticatedLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects a request with an expired or invalid session to login", async () => {
    mockSession(null, { message: "JWT expired" });

    await expect(AuthenticatedLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects when session lookup throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSessionLookupFailure(new Error("Session lookup failed"));

    await expect(AuthenticatedLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(consoleError).toHaveBeenCalledWith(
      "Error getting authenticated user:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("renders the protected page for a valid session", async () => {
    mockSession({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "user@example.com",
      },
    });

    const page = await AuthenticatedLayout({ children: null });

    expect(page).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
