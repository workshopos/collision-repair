import { cookies } from "next/headers";
import {
  assertTenantMembership,
  resolveTenantContext,
  type TenantContext,
} from "@/src/server/services/tenant-context";

export const ACTIVE_TENANT_CONTEXT_COOKIE = "workshopos_active_tenant";

type ActiveTenantCookieValue = {
  organisationId: string;
  branchId: string;
};

// This cookie is intentionally unsigned: every read revalidates its values against live membership data.
function encodeCookieValue(value: ActiveTenantCookieValue): string {
  return encodeURIComponent(JSON.stringify(value));
}

function decodeCookieValue(value: string): ActiveTenantCookieValue {
  const parsed: unknown = JSON.parse(decodeURIComponent(value));

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).organisationId !== "string" ||
    typeof (parsed as Record<string, unknown>).branchId !== "string"
  ) {
    throw new Error("Active tenant context cookie is invalid.");
  }

  return parsed as ActiveTenantCookieValue;
}

export async function setActiveTenantContextCookie(
  scope: TenantContext,
): Promise<void> {
  if (!scope.branchId) {
    throw new Error("Branch ID is required for an active branch context.");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_TENANT_CONTEXT_COOKIE,
    encodeCookieValue({
      organisationId: scope.organisationId,
      branchId: scope.branchId,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  );
}

export async function readActiveTenantContext(): Promise<TenantContext> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ACTIVE_TENANT_CONTEXT_COOKIE);

  if (!cookie) {
    throw new Error("Active tenant context is not set.");
  }

  const value = decodeCookieValue(cookie.value);
  const scope = await resolveTenantContext(value);

  return assertTenantMembership(scope);
}
