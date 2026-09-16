import Link from "next/link";
import { notFound } from "next/navigation";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { getVehicle } from "@/src/server/services/vehicles";
import { listCustomers } from "@/src/server/services/customers";
import { VehicleEditForm } from "@/src/components/forms/vehicle-edit-form";
import { ArchiveControl } from "@/src/components/forms/archive-control";
export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await readActiveTenantContext();
  const { id } = await params;
  const vehicle = await getVehicle(id, {
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
  });
  if (!vehicle) notFound();
  const customers = await listCustomers({
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
  });
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/vehicles" className="text-sm text-[#c0522e]">
        Back to vehicles
      </Link>
      <h1 className="mt-4 font-serif text-3xl">{vehicle.registration}</h1>
      <p className="mt-2 text-[#5d6864]">
        {vehicle.make} {vehicle.model} {vehicle.year || ""}
      </p>
      <VehicleEditForm
        vehicle={vehicle}
        customers={customers}
        tenant={tenant}
      />
      <ArchiveControl resource="vehicles" id={vehicle.id} />
    </div>
  );
}
