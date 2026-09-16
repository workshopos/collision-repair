"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantScope } from "@/src/lib/tenant";
import { requestJson } from "@/src/lib/api/client";
export function VehicleEditForm({
  vehicle,
  customers,
  tenant,
}: {
  vehicle: {
    id: string;
    customer_id: string;
    registration: string;
    vin: string | null;
    make: string;
    model: string;
    year: number | null;
    colour: string | null;
  };
  customers: { id: string; name: string }[];
  tenant: TenantScope;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await requestJson(
        `/api/v1/vehicles/${vehicle.id}?organisationId=${tenant.organisationId}&branchId=${tenant.branchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: form.get("customer_id"),
            registration: form.get("registration"),
            vin: form.get("vin") || null,
            make: form.get("make"),
            model: form.get("model"),
            year: form.get("year") ? Number(form.get("year")) : null,
            colour: form.get("colour") || null,
          }),
        },
        "Unable to update vehicle.",
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update vehicle.",
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
        Customer
        <select
          name="customer_id"
          defaultValue={vehicle.customer_id}
          className="mt-2 h-10 w-full border border-[#d8d0c4] bg-white px-3"
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Registration
        <input
          required
          name="registration"
          defaultValue={vehicle.registration}
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        VIN
        <input
          name="vin"
          defaultValue={vehicle.vin ?? ""}
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Make
          <input
            required
            name="make"
            defaultValue={vehicle.make}
            className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Model
          <input
            required
            name="model"
            defaultValue={vehicle.model}
            className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Year
          <input
            type="number"
            name="year"
            defaultValue={vehicle.year ?? ""}
            className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Colour
          <input
            name="colour"
            defaultValue={vehicle.colour ?? ""}
            className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
          />
        </label>
      </div>
      <button
        disabled={saving}
        className="bg-[#202c2b] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
