import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { listCustomers } from "@/src/server/services/customers";
import { listVehicles } from "@/src/server/services/vehicles";
import { RepairOrderForm } from "@/src/components/forms/repair-order-form";
export default async function NewRepairOrderPage() {
  const tenant = await readActiveTenantContext();
  const [customers, vehicles] = await Promise.all([
    listCustomers({
      organisationId: tenant.organisationId,
      branchId: tenant.branchId!,
    }),
    listVehicles({
      organisationId: tenant.organisationId,
      branchId: tenant.branchId!,
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">New repair order</h1>
      <RepairOrderForm
        tenant={tenant}
        customers={customers}
        vehicles={vehicles}
      />
    </div>
  );
}
