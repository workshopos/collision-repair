import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/src/components/layout/app-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const tenantContext = {
  organisationId: "11111111-1111-4111-8111-111111111111",
  branchId: "22222222-2222-4222-8222-222222222222",
};

function renderShell(permissions: string[] = []) {
  return render(
    <AppShell
      user={{ email: "operator@example.com", id: "user-1" }}
      tenantContext={tenantContext}
      permissions={new Set(permissions)}
    >
      <h1>Dashboard content</h1>
    </AppShell>,
  );
}

describe("Authenticated application shell", () => {
  it("renders tenant context, user menu, and dashboard navigation", () => {
    renderShell();

    expect(screen.getByText(/Organisation 11111111/)).toBeInTheDocument();
    expect(screen.getByText(/Branch 22222222/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open user menu" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("link", { name: "Repair Orders" }),
    ).not.toBeInTheDocument();
  });

  it("shows Repair Orders only with repair_order.view", () => {
    renderShell(["repair_order.view"]);

    expect(screen.getByRole("link", { name: "Repair Orders" })).toHaveAttribute(
      "href",
      "/repair-orders",
    );
  });
});
