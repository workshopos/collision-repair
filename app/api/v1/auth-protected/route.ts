import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/src/lib/auth/session";
import { apiError } from "@/src/lib/api-response";

export async function POST() {
  try {
    await requireAuthenticatedUser();

    return NextResponse.json({ message: "Authenticated" }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    console.error("Protected route authentication error:", error);
    return apiError("INTERNAL_ERROR", "Authentication check failed.", 500);
  }
}
