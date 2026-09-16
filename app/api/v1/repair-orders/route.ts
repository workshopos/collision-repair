import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/src/lib/auth/session";
import { createAdminSupabaseClient } from "@/src/lib/auth/server";
import { assertPermission } from "@/src/server/services/rbac-engine";
import { listRepairOrders } from "@/src/server/services/repair-orders";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { getCustomer } from "@/src/server/services/customers";
import { getVehicle } from "@/src/server/services/vehicles";
import { z } from "zod";
import { apiError, apiServerError } from "@/src/lib/api-response";

class ReferenceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceNotFoundError";
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const createRepairOrderSchema = z.object({
  organisationId: z.string().uuid("Organisation ID must be a valid UUID."),
  branchId: z.string().uuid("Branch ID must be a valid UUID."),
  ro_number: z.string().trim().min(1).max(100),
  lifecycle_status: z.enum(["intake"]).optional(),
  status: z.enum(["intake"]).optional(),
  customer_id: z.string().uuid().nullable().optional(),
  vehicle_id: z.string().uuid().nullable().optional(),
});

function parsePositiveInteger(value: string | null, fallback: number) {
  if (value === null) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const organisationId = searchParams.get("organisationId");
    const branchId = searchParams.get("branchId");

    if (!organisationId || !branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "organisationId and branchId query parameters are required.",
        400,
      );
    }

    const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(
      searchParams.get("page_size"),
      DEFAULT_PAGE_SIZE,
    );

    if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
      return apiError(
        "VALIDATION_ERROR",
        `page must be a positive integer and page_size must be a positive integer no greater than ${MAX_PAGE_SIZE}.`,
        400,
      );
    }

    const scope = await resolveTenantContext({ organisationId, branchId });
    const validatedScope = await assertTenantMembership(scope);

    await assertPermission(
      user.id,
      "repair_order.view",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const result = await listRepairOrders({
      organisationId: validatedScope.organisationId,
      branchId: validatedScope.branchId ?? branchId,
      page,
      pageSize,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    if (error instanceof Error) {
      if (error.message.includes("lacks permission")) {
        return apiError(
          "FORBIDDEN",
          "You do not have permission to perform this action.",
          403,
        );
      }

      if (
        error.message.includes("not a member") ||
        error.message.includes("Invalid tenant scope")
      ) {
        return apiError(
          "FORBIDDEN",
          "You do not have access to this workspace.",
          403,
        );
      }
    }

    console.error("Repair order list error:", error);
    return apiServerError("Unable to load repair orders.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = createRepairOrderSchema.parse(await request.json());
    const lifecycleStatus = body.lifecycle_status ?? body.status ?? "intake";
    const scope = await resolveTenantContext({
      organisationId: body.organisationId,
      branchId: body.branchId,
    });
    const validatedScope = await assertTenantMembership(scope);
    const branchId = validatedScope.branchId;

    if (!branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to create a repair order.",
        400,
      );
    }

    await assertPermission(
      user.id,
      "repair_order.create",
      validatedScope.organisationId,
      branchId,
    );

    if (body.customer_id) {
      const customer = await getCustomer(body.customer_id, {
        organisationId: validatedScope.organisationId,
        branchId,
      });
      if (!customer) {
        throw new ReferenceNotFoundError(
          "Customer does not exist in this workspace.",
        );
      }
    }

    if (body.vehicle_id) {
      const vehicle = await getVehicle(body.vehicle_id, {
        organisationId: validatedScope.organisationId,
        branchId,
      });
      if (!vehicle) {
        throw new ReferenceNotFoundError(
          "Vehicle does not exist in this workspace.",
        );
      }
    }

    const client = await createAdminSupabaseClient();
    const { data, error } = await client
      .from("repair_orders")
      .insert({
        organisation_id: validatedScope.organisationId,
        branch_id: branchId,
        ro_number: body.ro_number,
        lifecycle_status: lifecycleStatus,
        primary_repair_stage: null,
        customer_id: body.customer_id ?? null,
        vehicle_id: body.vehicle_id ?? null,
        created_by: user.id,
      })
      .select(
        `
        id,
        organisation_id,
        branch_id,
        ro_number,
        lifecycle_status,
        primary_repair_stage,
        customer_id,
        vehicle_id,
        created_by,
        created_at,
        updated_at
        `,
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(
          "DUPLICATE",
          "A repair order with this RO number already exists in the organisation.",
          409,
        );
      }

      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    if (error instanceof z.ZodError) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid repair order payload.",
        400,
        error.flatten(),
      );
    }

    if (error instanceof ReferenceNotFoundError) {
      return apiError("REFERENCE_NOT_FOUND", error.message, 404);
    }

    if (error instanceof Error) {
      if (error.message.includes("lacks permission")) {
        return apiError(
          "FORBIDDEN",
          "You do not have permission to perform this action.",
          403,
        );
      }

      if (
        error.message.includes("not a member") ||
        error.message.includes("Invalid tenant scope")
      ) {
        return apiError(
          "FORBIDDEN",
          "You do not have access to this workspace.",
          403,
        );
      }
    }

    console.error("Repair order create error:", error);
    return apiServerError("Unable to create repair order.");
  }
}
