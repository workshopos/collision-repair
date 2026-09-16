import { requireAuthenticatedUser } from "@/src/lib/auth/session";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";

export default async function SettingsPage() {
  const user = await requireAuthenticatedUser();
  const tenant = await readActiveTenantContext();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c0522e]">
        Workspace
      </p>
      <h1 className="mt-2 font-serif text-3xl">Settings</h1>
      <dl className="mt-8 grid gap-5 border-t border-[#d8d0c4] pt-6 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#7c8780]">
            Profile
          </dt>
          <dd className="mt-1 text-sm">{user.email ?? "No email"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#7c8780]">
            Organisation
          </dt>
          <dd className="mt-1 break-all text-sm">{tenant.organisationId}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#7c8780]">
            Branch
          </dt>
          <dd className="mt-1 break-all text-sm">{tenant.branchId}</dd>
        </div>
      </dl>
    </div>
  );
}
