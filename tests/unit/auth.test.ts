import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Auth Configuration Tests
 *
 * Tests for environment configuration validation
 */

describe("Authentication Configuration", () => {
  beforeEach(() => {
    // Clear any mocked environment variables
    vi.clearAllMocks();
  });

  it("should export configuration objects", async () => {
    const { publicEnv, serverEnv } = await import("@/src/lib/auth/config");

    // Should have the expected structure even if values are empty
    expect(publicEnv).toHaveProperty("supabaseUrl");
    expect(publicEnv).toHaveProperty("supabaseAnonKey");
    expect(serverEnv).toHaveProperty("supabaseServiceRoleKey");
  });

  it("should have validate function available", async () => {
    const { validateEnvironment } = await import("@/src/lib/auth/config");

    // Function should be callable
    expect(typeof validateEnvironment).toBe("function");
  });

  it("should expose only public variables to browser", async () => {
    const { publicEnv } = await import("@/src/lib/auth/config");

    // Verify that serverEnv is not exposed through publicEnv
    expect(publicEnv).not.toHaveProperty("supabaseServiceRoleKey");
  });
});

/**
 * Client Initialization Tests
 */
describe("Supabase Client", () => {
  it("should export a client initialization function", async () => {
    // This is a compile-time check
    // The function exists and is importable
    const { getSupabaseClient } = await import("@/src/lib/auth/client");
    expect(typeof getSupabaseClient).toBe("function");
  });
});

/**
 * Session Utilities Tests
 */
describe("Session Utilities", () => {
  it("should export session check functions", async () => {
    const { getCurrentUser, isAuthenticated } =
      await import("@/src/lib/auth/session");
    expect(typeof getCurrentUser).toBe("function");
    expect(typeof isAuthenticated).toBe("function");
  });
});

/**
 * Auth Module Exports Tests
 */
describe("Auth Module Exports", () => {
  it("should export all required authentication utilities", async () => {
    const authModule = await import("@/src/lib/auth");

    expect(authModule.publicEnv).toBeDefined();
    expect(authModule.serverEnv).toBeDefined();
    expect(authModule.validateEnvironment).toBeDefined();
    expect(authModule.getSupabaseClient).toBeDefined();
    expect(authModule.createServerSupabaseClient).toBeDefined();
    expect(authModule.createAdminSupabaseClient).toBeDefined();
    expect(authModule.getCurrentSession).toBeDefined();
    expect(authModule.getCurrentUser).toBeDefined();
    expect(authModule.isAuthenticated).toBeDefined();
  });
});
