"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArchiveControl({
  resource,
  id,
}: {
  resource: "customers" | "vehicles";
  id: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const label = resource === "customers" ? "customer" : "vehicle";

  async function archive() {
    if (!window.confirm(`Archive this ${label}?`)) return;
    setSaving(true);
    const response = await fetch(`/api/v1/${resource}/${id}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (response.ok) router.push(`/${resource}`);
  }

  return (
    <button
      type="button"
      onClick={archive}
      disabled={saving}
      className="mt-8 border border-[#c0522e] px-4 py-2.5 text-sm font-medium text-[#c0522e] disabled:opacity-50"
    >
      {saving ? "Archiving..." : `Archive ${label}`}
    </button>
  );
}
