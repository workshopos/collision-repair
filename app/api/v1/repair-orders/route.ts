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
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const createRepairOrderSchema = z.object({
  organisationId: z.string().uuid("Organisation ID must be a valid UUID."),
  branchId: z.string().uuid("Branch ID must be a valid UUID."),
  ro_number: z.string().trim().min(1).max(100),
  lifecycle_status: z.enum(["intake"]).optional(),
  status: z.enum(["intake"]).optional(),
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
      return NextResponse.json(
        {
          error: "organisationId and branchId query parameters are required",
        },
        { status: 400 },
      );
    }

    const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(
      searchParams.get("page_size"),
      DEFAULT_PAGE_SIZE,
    );

    if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
      return NextResponse.json(
        {
          error: `page must be a positive integer and page_size must be a positive integer no greater than ${MAX_PAGE_SIZE}`,
        },
        { status: 400 },
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
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
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

    console.error("Repair order list error:", error);
    return NextResponse.json(
      { error: "Repair order lookup failed" },
      { status: 500 },
    );
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

    await assertPermission(
      user.id,
      "repair_order.create",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const client = await createAdminSupabaseClient();
    const { data, error } = await client
      .from("repair_orders")
      .insert({
        organisation_id: validatedScope.organisationId,
        branch_id: validatedScope.branchId,
        ro_number: body.ro_number,
        lifecycle_status: lifecycleStatus,
        primary_repair_stage: null,
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
        return NextResponse.json(
          {
            error:
              "A repair order with this ro_number already exists in the organisation",
          },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid repair order payload" },
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

    console.error("Repair order create error:", error);
    return NextResponse.json(
      { error: "Repair order creation failed" },
      { status: 500 },
    );
  }
}
