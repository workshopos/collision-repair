import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js Image component
vi.mock("next/image", () => {
  return {
    default: (props: Record<string, unknown>) => {
      return React.createElement("img", props);
    },
  };
});

// Mock Next.js router if needed
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: "/",
    route: "/",
    asPath: "/",
    query: {},
    isReady: true,
  }),
}));
