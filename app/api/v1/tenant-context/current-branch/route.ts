import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "@/src/lib/auth";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";

export async function GET() {
  try {
    const scope = await readActiveTenantContext();

    return NextResponse.json(scope, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Tenant context lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
