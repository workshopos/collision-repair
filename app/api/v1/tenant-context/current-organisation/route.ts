import { NextResponse } from "next/server";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { AuthenticationRequiredError } from "@/src/lib/auth";
import { apiError } from "@/src/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const organisationId =
      body && typeof body === "object" && "organisationId" in body
        ? body.organisationId
        : undefined;
    const scope = await resolveTenantContext({
      organisationId:
        typeof organisationId === "string" ? organisationId : undefined,
    });

    await assertTenantMembership(scope);

    return NextResponse.json(
      { organisationId: scope.organisationId },
      { status: 200 },
    );
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
      error instanceof Error ? error.message : "Tenant selection failed";
    return apiError("FORBIDDEN", message, 403);
  }
}
