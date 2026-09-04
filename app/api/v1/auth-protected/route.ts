import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/src/lib/auth/session";

export async function POST() {
  try {
    await requireAuthenticatedUser();

    return NextResponse.json({ message: "Authenticated" }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    console.error("Protected route authentication error:", error);
    return NextResponse.json(
      { error: "Authentication check failed" },
      { status: 500 },
    );
  }
}
