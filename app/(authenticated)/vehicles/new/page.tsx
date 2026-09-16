import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { listCustomers } from "@/src/server/services/customers";
import { VehicleForm } from "@/src/components/forms/vehicle-form";
export default async function NewVehiclePage() {
  const tenant = await readActiveTenantContext();
  const customers = await listCustomers({
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
  });
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">New vehicle</h1>
      <p className="mt-2 text-sm text-[#5d6864]">
        Associate a vehicle with a customer.
      </p>
      <VehicleForm tenant={tenant} customers={customers} />
    </div>
  );
}
