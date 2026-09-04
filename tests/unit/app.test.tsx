import { describe, it, expect } from "vitest";

/**
 * Application Structure Tests
 *
 * Verifies that all required application files exist and can be imported
 */

describe("Application Structure", () => {
  it("should have login page component file", async () => {
    // Verify the login page file exists by checking it has exports
    const loginPageModule = await import("@/app/login/page");
    expect(loginPageModule).toBeDefined();
    // Client component exports as default
    expect(loginPageModule.default).toBeDefined();
  });

  it("should have home page component file", async () => {
    // Verify the home page file exists
    const homePageModule = await import("@/app/(authenticated)/page");
    expect(homePageModule).toBeDefined();
    expect(homePageModule.default).toBeDefined();
  });
});
