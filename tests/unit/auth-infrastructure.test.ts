import { describe, it, expect } from "vitest";

/**
 * Authentication Infrastructure Tests
 *
 * Tests core authentication module exports and structure
 */

describe("Authentication Module", () => {
  it("should export login page component", async () => {
    const { default: LoginPage } = await import("@/app/login/page");
    expect(LoginPage).toBeDefined();
    expect(typeof LoginPage).toBe("function");
  });

  it("should export auth middleware", async () => {
    const middleware = await import("@/middleware");
    // Middleware exports named exports, not default
    expect(middleware.middleware).toBeDefined();
    expect(middleware.config).toBeDefined();
  });

  it("should have login API route handler", async () => {
    const loginRoute = await import("@/app/api/auth/login/route");
    expect(loginRoute.POST).toBeDefined();
    expect(typeof loginRoute.POST).toBe("function");
  });

  it("should have logout API route handler", async () => {
    const logoutRoute = await import("@/app/api/auth/logout/route");
    expect(logoutRoute.POST).toBeDefined();
    expect(typeof logoutRoute.POST).toBe("function");
  });

  it("should export session utilities", async () => {
    const { getCurrentUser, getCurrentSession, isAuthenticated } =
      await import("@/src/lib/auth/session");

    expect(typeof getCurrentUser).toBe("function");
    expect(typeof getCurrentSession).toBe("function");
    expect(typeof isAuthenticated).toBe("function");
  });

  it("should export Supabase client/server utilities", async () => {
    const {
      getSupabaseClient,
      createServerSupabaseClient,
      createAdminSupabaseClient,
    } = await import("@/src/lib/auth");

    expect(typeof getSupabaseClient).toBe("function");
    expect(typeof createServerSupabaseClient).toBe("function");
    expect(typeof createAdminSupabaseClient).toBe("function");
  });

  it("should export environment configuration", async () => {
    const { publicEnv, serverEnv, validateEnvironment } =
      await import("@/src/lib/auth/config");

    expect(publicEnv).toBeDefined();
    expect(serverEnv).toBeDefined();
    expect(typeof validateEnvironment).toBe("function");

    // Verify environment shape
    expect(publicEnv).toHaveProperty("supabaseUrl");
    expect(publicEnv).toHaveProperty("supabaseAnonKey");
    expect(serverEnv).toHaveProperty("supabaseServiceRoleKey");
  });
});

/**
 * Authentication Security Tests
 *
 * Verify that sensitive data is not exposed
 */

describe("Authentication Security", () => {
  it("publicEnv should not contain service role key", async () => {
    const { publicEnv } = await import("@/src/lib/auth/config");

    // Service role key should never be in public environment
    expect(publicEnv).not.toHaveProperty("supabaseServiceRoleKey");
    expect(publicEnv).not.toHaveProperty("serviceRoleKey");
  });

  it("should have authentication routes", async () => {
    const loginRoute = await import("@/app/api/auth/login/route");
    const logoutRoute = await import("@/app/api/auth/logout/route");

    // Both routes should be POST endpoints
    expect(loginRoute.POST).toBeDefined();
    expect(logoutRoute.POST).toBeDefined();
  });
});
