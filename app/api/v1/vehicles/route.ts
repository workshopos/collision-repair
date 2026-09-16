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
import { createVehicle, listVehicles } from "@/src/server/services/vehicles";
import { apiError, apiServerError } from "@/src/lib/api-response";

const vehicleSchema = z.object({
  customer_id: z.string().uuid(),
  registration: z.string().trim().min(1).max(30),
  vin: z.string().trim().max(40).optional().or(z.literal("")),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(2200).nullable().optional(),
  colour: z.string().trim().max(50).optional().or(z.literal("")),
});

async function getScope(request: Request) {
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
    const validated = await getScope(request);
    if (!validated.branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to manage vehicles.",
        400,
      );
    }
    const search = new URL(request.url).searchParams.get("search") ?? undefined;
    return NextResponse.json({
      data: await listVehicles({
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
    return apiServerError("Unable to load vehicles.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const validated = await getScope(request);
    if (!validated.branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to manage vehicles.",
        400,
      );
    }
    const body = vehicleSchema.parse(await request.json());
    return NextResponse.json(
      {
        data: await createVehicle(
          {
            ...body,
            vin: body.vin || null,
            colour: body.colour || null,
            year: body.year ?? null,
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
        "Invalid vehicle details.",
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
    return apiServerError("Unable to create vehicle.");
  }
}
