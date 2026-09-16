"use client";

import { FormEvent, useEffect, useState } from "react";

type Branch = { id: string; name: string; code: string };
type Organisation = { id: string; name: string; branches: Branch[] };

export function WorkspaceSelector() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [organisationId, setOrganisationId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/tenant-context/options")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load workspace options.");
        return response.json() as Promise<{ organisations: Organisation[] }>;
      })
      .then((data) => {
        setOrganisations(data.organisations);
        if (data.organisations.length === 1) {
          setOrganisationId(data.organisations[0].id);
        }
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load workspace options.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const branches =
    organisations.find((organisation) => organisation.id === organisationId)
      ?.branches ?? [];

  function handleOrganisationChange(value: string) {
    setOrganisationId(value);
    setBranchId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/tenant-context/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisationId, branchId }),
      });

      if (!response.ok) throw new Error("Unable to select that workspace.");
      window.location.reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to select that workspace.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] px-6 py-12">
      <section className="w-full max-w-md border border-[#d8d0c4] bg-[#fffdf8] p-8 shadow-[8px_8px_0_#d8d0c4]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c0522e]">
          Workspace context required
        </p>
        <h1 className="font-serif text-3xl text-[#202c2b]">
          Select an organisation and branch to continue.
        </h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-[#202c2b]">
            Organisation
            <select
              className="mt-2 block min-h-11 w-full border border-[#bdb7ac] bg-white px-3 text-sm"
              disabled={loading || submitting}
              value={organisationId}
              onChange={(event) => handleOrganisationChange(event.target.value)}
            >
              <option value="">Select an organisation</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#202c2b]">
            Branch
            <select
              required
              className="mt-2 block min-h-11 w-full border border-[#bdb7ac] bg-white px-3 text-sm"
              disabled={!organisationId || loading || submitting}
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-[#a33b25]">{error}</p> : null}
          <button
            className="min-h-11 w-full bg-[#202c2b] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || submitting || !organisationId || !branchId}
            type="submit"
          >
            {submitting ? "Opening workspace..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
