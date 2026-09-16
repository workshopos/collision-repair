import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { CustomerForm } from "@/src/components/forms/customer-form";

export default async function NewCustomerPage() {
  const tenant = await readActiveTenantContext();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">New customer</h1>
      <p className="mt-2 text-sm text-[#5d6864]">
        Add a customer to the active workshop.
      </p>
      <CustomerForm tenant={tenant} />
    </div>
  );
}
