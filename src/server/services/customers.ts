import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/src/lib/auth/server";

export type Customer = {
  id: string;
  organisation_id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  customer_reference: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCustomers(scope: {
  organisationId: string;
  branchId: string;
  search?: string;
}) {
  const client = await createServerSupabaseClient();
  let query = client
    .from("customers")
    .select("*")
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null)
    .order("name");
  if (scope.search) {
    const search = scope.search.replaceAll(",", "\\,");
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,customer_reference.ilike.%${search}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function getCustomer(
  id: string,
  scope: { organisationId: string; branchId: string },
) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

export async function createCustomer(
  payload: Omit<
    Customer,
    "id" | "created_at" | "updated_at" | "organisation_id" | "branch_id"
  >,
  scope: { organisationId: string; branchId: string },
) {
  const client = await createAdminSupabaseClient();
  const { data, error } = await client
    .from("customers")
    .insert({
      ...payload,
      organisation_id: scope.organisationId,
      branch_id: scope.branchId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(
  id: string,
  payload: Partial<
    Pick<
      Customer,
      "name" | "phone" | "email" | "address" | "customer_reference"
    >
  >,
  scope: { organisationId: string; branchId: string },
) {
  const client = await createAdminSupabaseClient();
  const { data, error } = await client
    .from("customers")
    .update(payload)
    .eq("id", id)
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}
