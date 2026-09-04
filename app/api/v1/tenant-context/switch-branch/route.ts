import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "@/src/lib/auth";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { setActiveTenantContextCookie } from "@/src/server/services/active-tenant-context";

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
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Branch switching failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
