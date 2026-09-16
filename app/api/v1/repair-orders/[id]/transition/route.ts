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

const primaryRepairStageSchema = z.enum([
  "disassembly",
  "parts_ordering",
  "panel_beating",
  "paint_preparation",
  "painting",
  "assembly",
  "outwork_polishing",
  "final_inspection",
]);

const transitionRepairOrderSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_repair") }),
  z.object({ action: z.literal("advance") }),
  z.object({
    action: z.literal("reject_to_stage"),
    target_stage: primaryRepairStageSchema,
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("deliver") }),
  z.object({ action: z.literal("cancel") }),
]);

const repairOrderSelect = `
        id,
        organisation_id,
        branch_id,
        ro_number,
        lifecycle_status,
        primary_repair_stage,
        created_by,
        created_at,
        updated_at,
        archived_at
        `;

const additionalPermissionByAction: Partial<Record<string, string>> = {
  cancel: "repair_order.cancel",
  complete: "repair_order.close",
  deliver: "repair_order.close",
};

export async function POST(
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

    const body = transitionRepairOrderSchema.parse(await request.json());

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

    if (existingRow.archived_at) {
      return apiError(
        "INVALID_STATE",
        "Repair order is archived and cannot be transitioned.",
        409,
      );
    }

    const scope = await resolveTenantContext({
      organisationId: existingRow.organisation_id,
      branchId: existingRow.branch_id,
    });
    const validatedScope = await assertTenantMembership(scope);

    await assertPermission(
      user.id,
      "repair_order.transition",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const additionalPermission = additionalPermissionByAction[body.action];
    if (additionalPermission) {
      await assertPermission(
        user.id,
        additionalPermission,
        validatedScope.organisationId,
        validatedScope.branchId,
      );
    }

    const adminClient = await createAdminSupabaseClient();
    const { data, error } = await adminClient.rpc("transition_repair_order", {
      p_repair_order_id: parsedId.data,
      p_action: body.action,
      p_actor_id: user.id,
      p_organisation_id: validatedScope.organisationId,
      p_branch_id: validatedScope.branchId,
      p_target_stage: "target_stage" in body ? body.target_stage : null,
      p_reason: "reason" in body ? body.reason : null,
    });

    if (error) {
      const message = String(error.message ?? "");

      if (error.code === "P0002" || message.includes("not found")) {
        return apiError("NOT_FOUND", "Repair order not found.", 404);
      }

      if (
        error.code === "P0001" &&
        (message.includes("Invalid transition") ||
          message.includes("must be earlier than current stage") ||
          message.includes("cannot start_repair") ||
          message.includes("cannot advance") ||
          message.includes("cannot complete") ||
          message.includes("cannot cancel") ||
          message.includes("cannot deliver") ||
          message.includes("requires a non-empty p_reason") ||
          message.includes("requires p_target_stage"))
      ) {
        return apiError(
          "INVALID_STATE",
          "Invalid repair order transition.",
          409,
        );
      }

      if (message.includes("tenant scope does not match")) {
        return apiError(
          "CONFLICT",
          "Repair order tenant scope does not match.",
          409,
        );
      }

      if (message.includes("archived")) {
        return apiError(
          "INVALID_STATE",
          "Repair order is archived and cannot be transitioned.",
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
        "Invalid repair order transition payload.",
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

    console.error("Repair order transition error:", error);
    return apiServerError("Unable to transition repair order.");
  }
}
