import Link from "next/link";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { listVehicles } from "@/src/server/services/vehicles";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const tenant = await readActiveTenantContext();
  const { search } = await searchParams;
  const vehicles = await listVehicles({
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
    search,
  });
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c0522e]">
            Fleet
          </p>
          <h1 className="mt-2 font-serif text-3xl">Vehicles</h1>
        </div>
        <Link
          className="bg-[#202c2b] px-4 py-2 text-sm font-medium text-white"
          href="/vehicles/new"
        >
          New vehicle
        </Link>
      </div>
      <form className="mt-8 flex max-w-xl gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search registration, make or model"
          className="h-10 flex-1 border border-[#d8d0c4] bg-white px-3 text-sm"
        />
        <button className="bg-[#c0522e] px-4 text-sm font-medium text-white">
          Search
        </button>
      </form>
      <div className="mt-8 overflow-x-auto border-y border-[#d8d0c4] bg-[#fffdf8]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#d8d0c4] text-xs uppercase tracking-wide text-[#7c8780]">
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">VIN</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr className="border-b border-[#eee8de]" key={vehicle.id}>
                <td className="px-4 py-3">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/vehicles/${vehicle.id}`}
                  >
                    {vehicle.registration}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {vehicle.make} {vehicle.model}
                </td>
                <td className="px-4 py-3">
                  {(vehicle.customers as { name?: string } | null)?.name || "—"}
                </td>
                <td className="px-4 py-3">{vehicle.vin || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {vehicles.length === 0 && (
          <p className="px-4 py-8 text-sm text-[#7c8780]">No vehicles found.</p>
        )}
      </div>
    </div>
  );
}
