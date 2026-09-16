import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/src/lib/auth/server";
import {
  requireAuthenticatedUser,
  AuthenticationRequiredError,
} from "@/src/lib/auth/session";
import { assertPermission } from "@/src/server/services/rbac-engine";
import {
  assertTenantMembership,
  resolveTenantContext,
} from "@/src/server/services/tenant-context";
import { getCustomer, updateCustomer } from "@/src/server/services/customers";
import { apiError, apiServerError } from "@/src/lib/api-response";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    customer_reference: z.string().trim().max(100).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

async function getScope(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveTenantContext({
    organisationId: url.searchParams.get("organisationId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
  });
  return assertTenantMembership(resolved);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const validated = await getScope(request);
    if (!validated.branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to manage customers.",
        400,
      );
    }
    const { id } = await params;
    const data = await getCustomer(id, {
      organisationId: validated.organisationId,
      branchId: validated.branchId,
    });
    return data
      ? NextResponse.json({ data })
      : apiError("NOT_FOUND", "Customer not found.", 404);
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
    return apiServerError("Unable to load customer.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const validated = await getScope(request);
    if (!validated.branchId) {
      return apiError(
        "VALIDATION_ERROR",
        "An active branch must be selected to manage customers.",
        400,
      );
    }
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    return NextResponse.json({
      data: await updateCustomer(id, body, {
        organisationId: validated.organisationId,
        branchId: validated.branchId,
      }),
    });
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
    return apiServerError("Unable to update customer.");
  }
}

const customerSelect = `
  id, organisation_id, branch_id, name, phone, email, address,
  customer_reference, archived_at, created_at, updated_at
`;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success)
      return apiError("VALIDATION_ERROR", "Invalid customer ID.", 400);

    const sessionClient = await createServerSupabaseClient();
    const { data: existingRow, error: lookupError } = await sessionClient
      .from("customers")
      .select(customerSelect)
      .eq("id", parsedId.data)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existingRow || existingRow.archived_at)
      return apiError("NOT_FOUND", "Customer not found.", 404);

    const scope = await resolveTenantContext({
      organisationId: existingRow.organisation_id,
      branchId: existingRow.branch_id,
    });
    const validatedScope = await assertTenantMembership(scope);
    await assertPermission(
      user.id,
      "customer.archive",
      validatedScope.organisationId,
      validatedScope.branchId,
    );

    const archivedAt = new Date().toISOString();
    const adminClient = await createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from("customers")
      .update({ archived_at: archivedAt })
      .eq("id", existingRow.id)
      .eq("organisation_id", existingRow.organisation_id)
      .eq("branch_id", existingRow.branch_id)
      .is("archived_at", null)
      .select(customerSelect)
      .single();
    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    if (error instanceof Error) {
      if (error.message.includes("lacks permission"))
        return apiError(
          "FORBIDDEN",
          "You do not have permission to perform this action.",
          403,
        );
      if (
        error.message.includes("member") ||
        error.message.includes("Invalid tenant scope")
      )
        return apiError(
          "FORBIDDEN",
          "You do not have access to this workspace.",
          403,
        );
    }
    console.error("Customer archive error:", error);
    return apiServerError("Unable to archive customer.");
  }
}
