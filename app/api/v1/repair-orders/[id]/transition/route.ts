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
      return NextResponse.json(
        { error: "Invalid repair order ID" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Repair order not found" },
        { status: 404 },
      );
    }

    if (existingRow.archived_at) {
      return NextResponse.json(
        { error: "Repair order is archived and cannot be transitioned" },
        { status: 409 },
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
        return NextResponse.json(
          { error: "Repair order not found" },
          { status: 404 },
        );
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
        return NextResponse.json(
          { error: "Invalid repair order transition" },
          { status: 409 },
        );
      }

      if (message.includes("tenant scope does not match")) {
        return NextResponse.json(
          { error: "Repair order tenant scope does not match" },
          { status: 409 },
        );
      }

      if (message.includes("archived")) {
        return NextResponse.json(
          { error: "Repair order is archived and cannot be transitioned" },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid repair order transition payload" },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("lacks permission")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (
        error.message.includes("not a member") ||
        error.message.includes("Invalid tenant scope")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Repair order transition error:", error);
    return NextResponse.json(
      { error: "Repair order transition failed" },
      { status: 500 },
    );
  }
}
