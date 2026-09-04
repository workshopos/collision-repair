import { NextResponse } from "next/server";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { AuthenticationRequiredError } from "@/src/lib/auth";

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
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Tenant selection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
