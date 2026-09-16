import Link from "next/link";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { listCustomers } from "@/src/server/services/customers";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const tenant = await readActiveTenantContext();
  const { search } = await searchParams;
  const customers = await listCustomers({
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
    search,
  });
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c0522e]">
            Directory
          </p>
          <h1 className="mt-2 font-serif text-3xl">Customers</h1>
        </div>
        <Link
          className="bg-[#202c2b] px-4 py-2 text-sm font-medium text-white"
          href="/customers/new"
        >
          New customer
        </Link>
      </div>
      <form className="mt-8 flex max-w-xl gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name"
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
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr className="border-b border-[#eee8de]" key={customer.id}>
                <td className="px-4 py-3">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/customers/${customer.id}`}
                  >
                    {customer.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{customer.phone || "—"}</td>
                <td className="px-4 py-3">{customer.email || "—"}</td>
                <td className="px-4 py-3">
                  {customer.customer_reference || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="px-4 py-8 text-sm text-[#7c8780]">
            No customers found.
          </p>
        )}
      </div>
    </div>
  );
}
