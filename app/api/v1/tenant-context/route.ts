/**
 * Tenant-aware route boundary proof.
 *
 * This route accepts a candidate tenant scope from the request body only to
 * validate its format. The actual membership decision is derived from the
 * authenticated user/session by looking up real org/branch memberships in the DB.
 */

import { NextResponse } from "next/server";
import {
  defaultTenantMembershipCheck,
  normaliseTenantContext,
} from "@/src/server/services/tenant-context";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const candidateScope = normaliseTenantContext({
      organisationId:
        typeof payload.organisationId === "string"
          ? payload.organisationId
          : undefined,
      branchId:
        typeof payload.branchId === "string" ? payload.branchId : undefined,
    });

    const isMember = await defaultTenantMembershipCheck(candidateScope);
    if (!isMember) {
      throw new Error(
        "The authenticated user is not a member of the requested organisation or branch.",
      );
    }

    return NextResponse.json(candidateScope, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tenant validation failed";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}
