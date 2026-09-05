import { createServerSupabaseClient } from "@/src/lib/auth/server";

export type RepairOrderRow = {
  id: string;
  organisation_id: string;
  branch_id: string;
  ro_number: string;
  lifecycle_status: string;
  primary_repair_stage: string | null;
  customer_id: string;
  vehicle_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export async function listRepairOrders(scope: {
  organisationId: string;
  branchId: string;
  page?: number;
  pageSize?: number;
}) {
  const page = scope.page ?? 1;
  const pageSize = Math.min(scope.pageSize ?? 25, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const client = await createServerSupabaseClient();
  const { data, count, error } = await client
    .from("repair_orders")
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
      updated_at,
      archived_at
      `,
      { count: "exact" },
    )
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data ?? []) as RepairOrderRow[],
    meta: { page, page_size: pageSize, total: count ?? 0 },
  };
}
