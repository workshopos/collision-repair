import { NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/src/lib/auth/server";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/src/lib/auth/session";
import { assertPermission } from "@/src/server/services/rbac-engine";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { z } from "zod";
import { apiError, apiServerError } from "@/src/lib/api-response";

const repairOrderIdSchema = z.string().uuid();

const updateRepairOrderSchema = z
  .object({
    ro_number: z.string().trim().min(1).max(100).optional(),
    customer_id: z.string().uuid().nullable().optional(),
    vehicle_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable repair order field is required",
  });

const repairOrderSelect = `
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
        updated_at,
        archived_at
        `;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;

    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return apiError("VALIDATION_ERROR", "Invalid repair order ID.", 400);
    }

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

    const scope = await resolveTenantContext({ organisationId, branchId });
    const validatedScope = await assertTenantMembership(scope);

    await assertPermission(
      user.id,
      "repair_order.view",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const client = await createServerSupabaseClient();
    const { data, error } = await client
      .from("repair_orders")
      .select(repairOrderSelect)
      .eq("id", id)
      .eq("organisation_id", validatedScope.organisationId)
      .eq("branch_id", validatedScope.branchId)
      .is("archived_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return apiError("NOT_FOUND", "Repair order not found.", 404);
    }

    return NextResponse.json({ data }, { status: 200 });
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

    console.error("Repair order read error:", error);
    return apiServerError("Unable to load repair order.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const parsedId = repairOrderIdSchema.safeParse(id);

    if (!parsedId.success) {
      return apiError("VALIDATION_ERROR", "Invalid repair order ID.", 400);
    }

    const body = updateRepairOrderSchema.parse(await request.json());
    const sessionClient = await createServerSupabaseClient();
    const { data: existingRow, error: lookupError } = await sessionClient
      .from("repair_orders")
      .select(repairOrderSelect)
      .eq("id", parsedId.data)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!existingRow) {
      return apiError("NOT_FOUND", "Repair order not found.", 404);
    }

    const scope = await resolveTenantContext({
      organisationId: existingRow.organisation_id,
      branchId: existingRow.branch_id,
    });
    const validatedScope = await assertTenantMembership(scope);

    await assertPermission(
      user.id,
      "repair_order.update",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const updatePayload: Record<string, string | null> = {};
    if (body.ro_number !== undefined) {
      updatePayload.ro_number = body.ro_number;
    }
    if (body.customer_id !== undefined) {
      updatePayload.customer_id = body.customer_id;
    }
    if (body.vehicle_id !== undefined) {
      updatePayload.vehicle_id = body.vehicle_id;
    }

    const adminClient = await createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from("repair_orders")
      .update(updatePayload)
      .eq("id", existingRow.id)
      .eq("organisation_id", existingRow.organisation_id)
      .eq("branch_id", existingRow.branch_id)
      .select(repairOrderSelect)
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

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    if (error instanceof z.ZodError) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid repair order update payload.",
        400,
        error.flatten(),
      );
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

    console.error("Repair order update error:", error);
    return apiServerError("Unable to update repair order.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const parsedId = repairOrderIdSchema.safeParse(id);

    if (!parsedId.success) {
      return apiError("VALIDATION_ERROR", "Invalid repair order ID.", 400);
    }

    const sessionClient = await createServerSupabaseClient();
    const { data: existingRow, error: lookupError } = await sessionClient
      .from("repair_orders")
      .select(repairOrderSelect)
      .eq("id", parsedId.data)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!existingRow || existingRow.archived_at) {
      return apiError("NOT_FOUND", "Repair order not found.", 404);
    }

    const scope = await resolveTenantContext({
      organisationId: existingRow.organisation_id,
      branchId: existingRow.branch_id,
    });
    const validatedScope = await assertTenantMembership(scope);

    await assertPermission(
      user.id,
      "repair_order.archive",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const archivedAt = new Date().toISOString();
    const adminClient = await createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from("repair_orders")
      .update({ archived_at: archivedAt })
      .eq("id", existingRow.id)
      .eq("organisation_id", existingRow.organisation_id)
      .eq("branch_id", existingRow.branch_id)
      .is("archived_at", null)
      .select(repairOrderSelect)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data }, { status: 200 });
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

    console.error("Repair order archive error:", error);
    return apiServerError("Unable to archive repair order.");
  }
}
