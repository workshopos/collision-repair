import Link from "next/link";
import { notFound } from "next/navigation";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { getCustomer } from "@/src/server/services/customers";
import { CustomerEditForm } from "@/src/components/forms/customer-edit-form";
import { ArchiveControl } from "@/src/components/forms/archive-control";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await readActiveTenantContext();
  const { id } = await params;
  const customer = await getCustomer(id, {
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
  });
  if (!customer) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/customers" className="text-sm text-[#c0522e]">
        Back to customers
      </Link>
      <h1 className="mt-4 font-serif text-3xl">{customer.name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#7c8780]">
            Phone
          </p>
          <p className="mt-1">{customer.phone || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[#7c8780]">
            Email
          </p>
          <p className="mt-1">{customer.email || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[#7c8780]">
            Reference
          </p>
          <p className="mt-1">{customer.customer_reference || "—"}</p>
        </div>
        <div className="sm:col-span-3">
          <p className="text-xs uppercase tracking-wide text-[#7c8780]">
            Address
          </p>
          <p className="mt-1 whitespace-pre-wrap">{customer.address || "—"}</p>
        </div>
      </div>
      <CustomerEditForm customer={customer} tenant={tenant} />
      <ArchiveControl resource="customers" id={customer.id} />
    </div>
  );
}
