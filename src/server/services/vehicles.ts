import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/src/lib/auth/server";

export type Vehicle = {
  id: string;
  organisation_id: string;
  branch_id: string;
  customer_id: string;
  registration: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  colour: string | null;
  created_at: string;
  updated_at: string;
};

export async function listVehicles(scope: {
  organisationId: string;
  branchId: string;
  search?: string;
}) {
  const client = await createServerSupabaseClient();
  let query = client
    .from("vehicles")
    .select("*, customers(name)")
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null)
    .order("registration");
  if (scope.search)
    query = query.or(
      `registration.ilike.%${scope.search}%,make.ilike.%${scope.search}%,model.ilike.%${scope.search}%`,
    );
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getVehicle(
  id: string,
  scope: { organisationId: string; branchId: string },
) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("vehicles")
    .select("*, customers(name)")
    .eq("id", id)
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createVehicle(
  payload: Omit<
    Vehicle,
    "id" | "created_at" | "updated_at" | "organisation_id" | "branch_id"
  >,
  scope: { organisationId: string; branchId: string },
) {
  const admin = await createAdminSupabaseClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id")
    .eq("id", payload.customer_id)
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null)
    .single();
  if (customerError || !customer)
    throw customerError ?? new Error("Customer not found");
  const { data, error } = await admin
    .from("vehicles")
    .insert({
      ...payload,
      organisation_id: scope.organisationId,
      branch_id: scope.branchId,
    })
    .select("*, customers(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(
  id: string,
  payload: Partial<
    Pick<
      Vehicle,
      | "customer_id"
      | "registration"
      | "vin"
      | "make"
      | "model"
      | "year"
      | "colour"
    >
  >,
  scope: { organisationId: string; branchId: string },
) {
  const admin = await createAdminSupabaseClient();
  if (payload.customer_id) {
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id")
      .eq("id", payload.customer_id)
      .eq("organisation_id", scope.organisationId)
      .eq("branch_id", scope.branchId)
      .is("archived_at", null)
      .single();
    if (customerError || !customer)
      throw customerError ?? new Error("Customer not found");
  }
  const { data, error } = await admin
    .from("vehicles")
    .update(payload)
    .eq("id", id)
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .select("*, customers(name)")
    .single();
  if (error) throw error;
  return data;
}
