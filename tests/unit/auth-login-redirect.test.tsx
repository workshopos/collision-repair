import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import { getCurrentUser } from "@/src/lib/auth";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/src/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/src/lib/auth")>("@/src/lib/auth");

  return {
    ...actual,
    getCurrentUser: vi.fn(),
  };
});

describe("Authenticated login redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a logged-in user to the home page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@example.com",
    } as never);

    await expect(LoginPage()).rejects.toThrow("REDIRECT:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders the login page for an unauthenticated user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const page = await LoginPage();

    expect(page).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
