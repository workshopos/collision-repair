import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "@/src/lib/auth";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { setActiveTenantContextCookie } from "@/src/server/services/active-tenant-context";
import { apiError } from "@/src/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const scope = await resolveTenantContext({
      organisationId:
        typeof payload.organisationId === "string"
          ? payload.organisationId
          : undefined,
      branchId:
        typeof payload.branchId === "string" ? payload.branchId : undefined,
    });

    const authorisedScope = await assertTenantMembership(scope);
    await setActiveTenantContextCookie(authorisedScope);

    return NextResponse.json(authorisedScope, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    if (
      error instanceof Error &&
      (error.message.includes("must be a valid UUID") ||
        error.message.includes("required for tenant resolution"))
    ) {
      return apiError("VALIDATION_ERROR", error.message, 400);
    }

    const message =
      error instanceof Error ? error.message : "Branch switching failed";
    return apiError("FORBIDDEN", message, 403);
  }
}
