"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantScope } from "@/src/lib/tenant";
import { requestJson } from "@/src/lib/api/client";
export function RepairOrderForm({
  tenant,
  customers,
  vehicles,
  initial,
}: {
  tenant: TenantScope;
  customers: { id: string; name: string }[];
  vehicles: {
    id: string;
    registration: string;
    make: string;
    model: string;
    customer_id: string;
  }[];
  initial?: {
    id: string;
    ro_number: string;
    customer_id: string | null;
    vehicle_id: string | null;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ro_number: form.get("ro_number"),
      customer_id: form.get("customer_id") || null,
      vehicle_id: form.get("vehicle_id") || null,
    };
    const url = initial
      ? `/api/v1/repair-orders/${initial.id}`
      : "/api/v1/repair-orders";
    try {
      const result = await requestJson<{ data: { id: string } }>(
        initial
          ? `${url}?organisationId=${tenant.organisationId}&branchId=${tenant.branchId}`
          : url,
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            initial
              ? payload
              : {
                  ...payload,
                  organisationId: tenant.organisationId,
                  branchId: tenant.branchId,
                },
          ),
        },
        "Unable to save repair order.",
      );
      router.push(`/repair-orders/${result.data.id}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save repair order.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-8 space-y-5 border border-[#d8d0c4] bg-[#fffdf8] p-6"
    >
      {error && (
        <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <label className="block text-sm font-medium">
        RO number
        <input
          required
          name="ro_number"
          defaultValue={initial?.ro_number}
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Customer
        <select
          name="customer_id"
          defaultValue={initial?.customer_id ?? ""}
          className="mt-2 h-10 w-full border border-[#d8d0c4] bg-white px-3"
        >
          <option value="">Unassigned</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Vehicle
        <select
          name="vehicle_id"
          defaultValue={initial?.vehicle_id ?? ""}
          className="mt-2 h-10 w-full border border-[#d8d0c4] bg-white px-3"
        >
          <option value="">Unassigned</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registration} · {vehicle.make} {vehicle.model}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={saving}
        className="bg-[#202c2b] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving
          ? "Saving..."
          : initial
            ? "Save changes"
            : "Create repair order"}
      </button>
    </form>
  );
}
