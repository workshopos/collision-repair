import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "@/src/lib/auth";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { apiError } from "@/src/lib/api-response";

export async function GET() {
  try {
    const scope = await readActiveTenantContext();

    return NextResponse.json(scope, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    const message =
      error instanceof Error ? error.message : "Tenant context lookup failed";
    return apiError("FORBIDDEN", message, 403);
  }
}
