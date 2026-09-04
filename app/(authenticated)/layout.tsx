import { redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/src/lib/auth";
import { getEffectivePermissions } from "@/src/server/services/rbac-engine";
import { readActiveTenantContext } from "@/src/server/services/active-tenant-context";
import { AppShell } from "@/src/components/layout/app-shell";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }
    throw error;
  }

  let tenantContext;
  try {
    tenantContext = await readActiveTenantContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
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
          <p className="mt-4 text-sm leading-6 text-[#5d6864]">
            Your active workspace is not selected yet. Choose a branch before
            opening the application.
          </p>
        </section>
      </main>
    );
  }

  const effectivePermissions = await getEffectivePermissions(
    user.id,
    tenantContext.organisationId,
    tenantContext.branchId,
  );

  return (
    <AppShell
      user={{ email: user.email ?? "", id: user.id }}
      tenantContext={tenantContext}
      permissions={effectivePermissions.permissions}
    >
      {children}
    </AppShell>
  );
}