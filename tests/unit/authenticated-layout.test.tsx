import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthenticatedLayout from "@/app/(authenticated)/layout";
import { requireAuthenticatedUser } from "@/src/lib/auth/session";
import { getEffectivePermissions } from "@/src/server/services/rbac-engine";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";

vi.mock("@/src/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/src/server/services/active-tenant-context", () => ({
  readActiveTenantContext: vi.fn(),
}));

vi.mock("@/src/server/services/rbac-engine", () => ({
  getEffectivePermissions: vi.fn(),
}));

describe("Authenticated layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "operator@example.com",
    } as never);
  });

  it("renders an explicit context-required state when no active tenant exists", async () => {
    vi.mocked(readActiveTenantContext).mockRejectedValue(
      new Error("Active tenant context is not set."),
    );

    const layout = await AuthenticatedLayout({ children: null });
    render(layout);

    expect(
      screen.getByRole("heading", {
        name: "Select an organisation and branch to continue.",
      }),
    ).toBeInTheDocument();
    expect(getEffectivePermissions).not.toHaveBeenCalled();
  });
});
