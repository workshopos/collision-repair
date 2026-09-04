import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as protectedRoute } from "@/app/api/v1/auth-protected/route";
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

function mockSession(session: unknown, error: unknown = null) {
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
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
      getSession: vi.fn().mockRejectedValue(error),
    },
  };

  vi.mocked(createServerSupabaseClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  );
}

describe("Authenticated route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request with no session before protected logic executes", async () => {
    mockSession(null);

    const response = await protectedRoute();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
  });

  it("rejects a request with an expired or invalid session", async () => {
    mockSession(null, { message: "JWT expired" });

    const response = await protectedRoute();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
  });

  it("rejects a request when session lookup throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSessionLookupFailure(new Error("Session lookup failed"));

    const response = await protectedRoute();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error getting session:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("allows a request with a valid session", async () => {
    mockSession({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
      },
    });

    const response = await protectedRoute();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Authenticated" });
  });
});
