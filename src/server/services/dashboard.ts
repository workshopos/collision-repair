import { createServerSupabaseClient } from "@/src/lib/auth/server";

export async function getDashboardMetrics(scope: {
  organisationId: string;
  branchId: string;
}) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("repair_orders")
    .select("lifecycle_status, primary_repair_stage")
    .eq("organisation_id", scope.organisationId)
    .eq("branch_id", scope.branchId)
    .is("archived_at", null);
  if (error) throw error;

  const rows = data ?? [];
  const count = (predicate: (row: (typeof rows)[number]) => boolean) =>
    rows.filter(predicate).length;

  return {
    activeJobs: count(
      (row) =>
        row.lifecycle_status === "intake" ||
        row.lifecycle_status === "in_repair",
    ),
    awaitingApproval: count((row) => row.lifecycle_status === "intake"),
    inRepair: count((row) => row.lifecycle_status === "in_repair"),
    qualityControl: count(
      (row) =>
        row.lifecycle_status === "in_repair" &&
        row.primary_repair_stage === "final_inspection",
    ),
    readyForCollection: count((row) => row.lifecycle_status === "completed"),
    completed: count((row) => row.lifecycle_status === "delivered"),
  };
}
