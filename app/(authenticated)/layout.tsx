import { redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/src/lib/auth";
import { getEffectivePermissions } from "@/src/server/services/rbac-engine";
import {
  MissingTenantContextError,
  readActiveTenantContext,
} from "@/src/server/services/active-tenant-context";
import { AppShell } from "@/src/components/layout/app-shell";
import { WorkspaceSelector } from "@/src/components/auth/workspace-selector";

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

    if (error instanceof MissingTenantContextError) {
      return <WorkspaceSelector />;
    }

    throw error;
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
