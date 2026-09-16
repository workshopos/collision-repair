/**
 * Signup API Route
 *
 * Creates a user account with Supabase Auth.
 */

import { createServerSupabaseClient } from "@/src/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const SignupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = SignupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp(validation.data);

    if (error) {
      return NextResponse.json(
        { error: "Unable to create account" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message: data.session
          ? "Account created"
          : "Account created. Check your email to confirm your account.",
        authenticated: Boolean(data.session),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An error occurred during signup" },
      { status: 500 },
    );
  }
}
