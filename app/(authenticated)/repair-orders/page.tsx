import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { listRepairOrders } from "@/src/server/services/repair-orders";

export default async function RepairOrdersPage() {
  const tenantContext = await readActiveTenantContext();
  const { data, meta } = await listRepairOrders({
    organisationId: tenantContext.organisationId,
    branchId: tenantContext.branchId!,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-2xl">Repair Orders</h1>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          No repair orders yet for this branch.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="py-2 font-medium">RO Number</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.map((ro) => (
              <tr key={ro.id} className="border-b border-neutral-100">
                <td className="py-2">{ro.ro_number}</td>
                <td className="py-2">{ro.lifecycle_status}</td>
                <td className="py-2">
                  {new Date(ro.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Page {meta.page} of {Math.ceil(meta.total / meta.page_size) || 1} ·{" "}
        {meta.total} total
      </p>
    </div>
  );
}
