import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  AuthenticationRequiredError,
} from "@/src/lib/auth/session";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { createCustomer, listCustomers } from "@/src/server/services/customers";
import { apiError, apiServerError } from "@/src/lib/api-response";

const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  customer_reference: z.string().trim().max(100).optional().or(z.literal("")),
});

async function scope(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveTenantContext({
    organisationId: url.searchParams.get("organisationId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
  });
  return assertTenantMembership(resolved);
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const validated = await scope(request);
    if (!validated.branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to manage customers.",
        400,
      );
    }
    const search = new URL(request.url).searchParams.get("search") ?? undefined;
    return NextResponse.json({
      data: await listCustomers({
        organisationId: validated.organisationId,
        branchId: validated.branchId,
        search,
      }),
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    if (
      error instanceof Error &&
      (error.message.includes("member") || error.message.includes("scope"))
    )
      return apiError(
        "FORBIDDEN",
        "You do not have access to this workspace.",
        403,
      );
    return apiServerError("Unable to load customers.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const validated = await scope(request);
    if (!validated.branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to manage customers.",
        400,
      );
    }
    const body = customerSchema.parse(await request.json());
    return NextResponse.json(
      {
        data: await createCustomer(
          {
            name: body.name,
            phone: body.phone || null,
            email: body.email || null,
            address: body.address || null,
            customer_reference: body.customer_reference || null,
          },
          {
            organisationId: validated.organisationId,
            branchId: validated.branchId,
          },
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    if (error instanceof z.ZodError)
      return apiError(
        "VALIDATION_ERROR",
        "Invalid customer details.",
        400,
        error.flatten(),
      );
    if (
      error instanceof Error &&
      (error.message.includes("member") || error.message.includes("scope"))
    )
      return apiError(
        "FORBIDDEN",
        "You do not have access to this workspace.",
        403,
      );
    return apiServerError("Unable to create customer.");
  }
}
