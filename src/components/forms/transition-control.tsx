"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function TransitionControl({
  id,
  lifecycleStatus,
  stage,
}: {
  id: string;
  lifecycleStatus: string;
  stage: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejectStage, setRejectStage] = useState("disassembly");
  const [rejectReason, setRejectReason] = useState("");
  const action =
    lifecycleStatus === "intake"
      ? "start_repair"
      : stage === "final_inspection"
        ? "complete"
        : lifecycleStatus === "completed"
          ? "deliver"
          : "advance";
  const label =
    action === "start_repair"
      ? "Start repair"
      : action === "complete"
        ? "Complete after inspection"
        : action === "deliver"
          ? "Mark delivered"
          : "Advance stage";
  async function transition() {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/repair-orders/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(result.error?.message || "Unable to transition repair order.");
      return;
    }
    router.refresh();
  }
  async function cancel() {
    await submitTransition({ action: "cancel" });
  }
  async function reject() {
    await submitTransition({
      action: "reject_to_stage",
      target_stage: rejectStage,
      reason: rejectReason,
    });
  }
  async function submitTransition(body: Record<string, string>) {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/repair-orders/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(result.error?.message || "Unable to transition repair order.");
      return;
    }
    router.refresh();
  }
  if (lifecycleStatus === "delivered" || lifecycleStatus === "cancelled")
    return null;
  return (
    <div className="mt-6">
      <button
        onClick={transition}
        disabled={saving}
        className="bg-[#c0522e] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Updating..." : label}
      </button>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <button
          onClick={cancel}
          disabled={saving}
          className="border border-[#c0522e] px-4 py-2.5 text-sm font-medium text-[#c0522e] disabled:opacity-50"
        >
          Cancel repair order
        </button>
        <select
          value={rejectStage}
          onChange={(event) => setRejectStage(event.target.value)}
          disabled={saving}
          aria-label="Reject to stage"
          className="border border-[#d8d0c4] bg-white px-3 py-2.5 text-sm"
        >
          {[
            "disassembly",
            "parts_ordering",
            "panel_beating",
            "paint_preparation",
            "painting",
            "assembly",
            "outwork_polishing",
            "final_inspection",
          ].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <input
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          disabled={saving}
          placeholder="Reason for rejection"
          aria-label="Reason for rejection"
          className="border border-[#d8d0c4] px-3 py-2.5 text-sm"
        />
        <button
          onClick={reject}
          disabled={saving || !rejectReason.trim()}
          className="border border-[#c0522e] px-4 py-2.5 text-sm font-medium text-[#c0522e] disabled:opacity-50"
        >
          Reject to stage
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
