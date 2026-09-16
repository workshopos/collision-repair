import Link from "next/link";
import { notFound } from "next/navigation";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import {
  getRepairOrder,
  listRepairOrderTransitions,
} from "@/src/server/services/repair-orders";
import { listCustomers } from "@/src/server/services/customers";
import { listVehicles } from "@/src/server/services/vehicles";
import { RepairOrderForm } from "@/src/components/forms/repair-order-form";
import { TransitionControl } from "@/src/components/forms/transition-control";
export default async function RepairOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await readActiveTenantContext();
  const { id } = await params;
  const order = await getRepairOrder(id, {
    organisationId: tenant.organisationId,
    branchId: tenant.branchId!,
  });
  if (!order) notFound();
  const [history, customers, vehicles] = await Promise.all([
    listRepairOrderTransitions(id),
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
    <div className="mx-auto max-w-5xl">
      <Link href="/repair-orders" className="text-sm text-[#c0522e]">
        Back to repair orders
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#7c8780]">
            Repair order
          </p>
          <h1 className="mt-2 font-serif text-3xl">{order.ro_number}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium uppercase text-[#c0522e]">
            {order.lifecycle_status.replaceAll("_", " ")}
          </p>
          <p className="text-sm text-[#5d6864]">
            {order.primary_repair_stage?.replaceAll("_", " ") ||
              "No active repair stage"}
          </p>
        </div>
      </div>
      <TransitionControl
        id={order.id}
        lifecycleStatus={order.lifecycle_status}
        stage={order.primary_repair_stage}
      />
      <RepairOrderForm
        tenant={tenant}
        customers={customers}
        vehicles={vehicles}
        initial={order}
      />
      <section className="mt-10">
        <h2 className="font-serif text-2xl">Transition history</h2>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-[#7c8780]">
            No transitions recorded yet.
          </p>
        ) : (
          <ol className="mt-4 border-l border-[#d8d0c4]">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="relative border-b border-[#eee8de] py-4 pl-5"
              >
                <span className="absolute -left-1.5 top-5 size-3 bg-[#c0522e]" />
                <p className="text-sm font-medium">
                  {String(entry.action).replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm text-[#5d6864]">
                  {String(entry.from_lifecycle_status).replaceAll("_", " ")} →{" "}
                  {String(entry.to_lifecycle_status).replaceAll("_", " ")}
                  {entry.to_primary_stage
                    ? ` · ${String(entry.to_primary_stage).replaceAll("_", " ")}`
                    : ""}
                </p>
                <time className="mt-1 block text-xs text-[#7c8780]">
                  {new Date(entry.transitioned_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
