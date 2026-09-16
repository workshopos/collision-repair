"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantScope } from "@/src/lib/tenant";
import { requestJson } from "@/src/lib/api/client";

export function CustomerForm({ tenant }: { tenant: TenantScope }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await requestJson<{ data: { id: string } }>(
        `/api/v1/customers?organisationId=${tenant.organisationId}&branchId=${tenant.branchId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email"),
            address: form.get("address"),
            customer_reference: form.get("customer_reference"),
          }),
        },
        "Unable to save customer.",
      );
      router.push(`/customers/${result.data.id}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save customer.",
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
        Name
        <input
          required
          name="name"
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Phone
        <input
          name="phone"
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input
          type="email"
          name="email"
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Address
        <textarea
          name="address"
          className="mt-2 min-h-24 w-full border border-[#d8d0c4] px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Customer reference
        <input
          name="customer_reference"
          className="mt-2 h-10 w-full border border-[#d8d0c4] px-3"
        />
      </label>
      <button
        disabled={saving}
        className="bg-[#202c2b] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Create customer"}
      </button>
    </form>
  );
}
