/**
 * Login API Route
 *
 * Authenticates user with email and password
 */

import { createServerSupabaseClient } from "@/src/lib/auth";
import { z } from "zod";
import { NextResponse } from "next/server";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const validation = LoginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;

    // Authenticate with Supabase
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { error: "No session created" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 },
    );
  }
}
