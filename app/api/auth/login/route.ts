/**
 * Login API Route
 *
 * Authenticates user with email and password
 */

import { createServerSupabaseClient } from "@/src/lib/auth";
import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, apiServerError } from "@/src/lib/api-response";
import { setActiveTenantContextCookie } from "@/src/server/services/active-tenant-context";

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
      return apiError(
        "VALIDATION_ERROR",
        "Invalid login details.",
        400,
        validation.error.flatten(),
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
      console.error("Supabase login failed:", {
        code: error.code,
        message: error.message,
        status: error.status,
      });

      const message =
        error.code === "email_not_confirmed"
          ? "Please confirm your email before signing in."
          : "Invalid email or password.";

      return apiError("UNAUTHENTICATED", message, 401);
    }

    if (!data.session) {
      return apiServerError("No session was created.");
    }

    const { data: branchMemberships, error: membershipError } = await supabase
      .from("branch_memberships")
      .select("organisation_id, branch_id")
      .eq("profile_id", data.user.id)
      .eq("is_active", true);

    if (membershipError) {
      console.error("Login tenant context lookup failed:", membershipError);
    } else if (branchMemberships?.length === 1) {
      await setActiveTenantContextCookie({
        organisationId: branchMemberships[0].organisation_id,
        branchId: branchMemberships[0].branch_id,
      });
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
    return apiServerError("An error occurred during login.");
  }
}
