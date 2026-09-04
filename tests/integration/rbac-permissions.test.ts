import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const serverCookies: Array<{ name: string; value: string }> = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => serverCookies,
    setAll: (cookiesToSet: Array<{ name: string; value: string }>) => {
      for (const cookie of cookiesToSet) {
        const index = serverCookies.findIndex(
          ({ name }) => name === cookie.name,
        );
        if (index >= 0) {
          serverCookies[index] = cookie;
        } else {
          serverCookies.push(cookie);
        }
      }
    },
  }),
}));

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "RBAC integration tests require SUPABASE_URL, SUPABASE_ANON_KEY, and " +
      "SUPABASE_SERVICE_ROLE_KEY to be set (see file header for setup).",
  );
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface RbacFixture {
  organisationId: string;
  userId: string;
  email: string;
  password: string;
  roleId: string;
  permissionId: string;
  permissionKey: string;
}

let assertPermission: typeof import("@/src/server/services/rbac-engine").assertPermission;
let hasPermission: typeof import("@/src/server/services/rbac-engine").hasPermission;

function setServerSessionCookie(session: unknown) {
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const encodedSession = Buffer.from(JSON.stringify(session)).toString(
    "base64url",
  );
  serverCookies.splice(0, serverCookies.length, {
    name: `sb-${projectRef}-auth-token`,
    value: `base64-${encodedSession}`,
  });
}

async function createRbacFixture(): Promise<RbacFixture> {
  const suffix = randomUUID().slice(0, 8);
  const email = `rbac-test-${suffix}@example.test`;
  const password = `Test-${suffix}!`;

  const { data: organisation, error: organisationError } = await admin
    .from("organisations")
    .insert({
      name: `RBAC Test Org ${suffix}`,
      slug: `rbac-test-org-${suffix}`,
    })
    .select("id")
    .single();
  if (organisationError) throw organisationError;

  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (authError) throw authError;

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    display_name: `RBAC Test User ${suffix}`,
  });
  if (profileError) throw profileError;

  const { error: membershipError } = await admin
    .from("organisation_memberships")
    .insert({
      organisation_id: organisation.id,
      profile_id: authUser.user.id,
    });
  if (membershipError) throw membershipError;

  const permissionKey = `rbac_test.${suffix}`;
  const { data: permission, error: permissionError } = await admin
    .from("permissions")
    .insert({
      key: permissionKey,
      resource: "rbac_test",
      action: suffix,
      description: "Temporary integration-test permission",
    })
    .select("id")
    .single();
  if (permissionError) throw permissionError;

  const { data: role, error: roleError } = await admin
    .from("roles")
    .insert({
      organisation_id: organisation.id,
      name: `RBAC Test Role ${suffix}`,
      slug: `rbac-test-role-${suffix}`,
    })
    .select("id")
    .single();
  if (roleError) throw roleError;

  const { error: rolePermissionError } = await admin
    .from("role_permissions")
    .insert({ role_id: role.id, permission_id: permission.id });
  if (rolePermissionError) throw rolePermissionError;

  const { error: userRoleError } = await admin.from("user_roles").insert({
    profile_id: authUser.user.id,
    role_id: role.id,
    organisation_id: organisation.id,
    branch_id: null,
  });
  if (userRoleError) throw userRoleError;

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: signInError } =
    await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  if (!sessionData.session)
    throw new Error("RBAC test session was not created");

  setServerSessionCookie(sessionData.session);
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;

  return {
    organisationId: organisation.id,
    userId: authUser.user.id,
    email,
    password,
    roleId: role.id,
    permissionId: permission.id,
    permissionKey,
  };
}

async function cleanupRbacFixture(fixture: RbacFixture | undefined) {
  if (!fixture) return;

  await admin.from("user_roles").delete().eq("profile_id", fixture.userId);
  await admin.from("role_permissions").delete().eq("role_id", fixture.roleId);
  await admin.from("roles").delete().eq("id", fixture.roleId);
  await admin.from("permissions").delete().eq("id", fixture.permissionId);
  await admin
    .from("organisation_memberships")
    .delete()
    .eq("profile_id", fixture.userId);
  await admin.auth.admin.deleteUser(fixture.userId);
  await admin.from("organisations").delete().eq("id", fixture.organisationId);
}

describe("RBAC: real effective permission checks", () => {
  let fixture: RbacFixture | undefined;

  beforeAll(async () => {
    fixture = await createRbacFixture();
    ({ assertPermission, hasPermission } =
      await import("@/src/server/services/rbac-engine"));
  }, 30_000);

  afterAll(async () => {
    await cleanupRbacFixture(fixture);
  });

  it("allows an assigned permission through the real RBAC chain", async () => {
    expect(fixture).toBeDefined();

    await expect(
      assertPermission(
        fixture!.userId,
        fixture!.permissionKey,
        fixture!.organisationId,
      ),
    ).resolves.toBeUndefined();
    await expect(
      hasPermission(
        fixture!.userId,
        fixture!.permissionKey,
        fixture!.organisationId,
      ),
    ).resolves.toBe(true);
  });

  it("denies an unassigned permission by default", async () => {
    expect(fixture).toBeDefined();

    const permission = "repair_order.permission_not_assigned";
    await expect(
      hasPermission(fixture!.userId, permission, fixture!.organisationId),
    ).resolves.toBe(false);
    await expect(
      assertPermission(fixture!.userId, permission, fixture!.organisationId),
    ).rejects.toThrow("lacks permission");
  });
});
