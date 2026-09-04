/**
 * tests/integration/rls-tenant-isolation.test.ts
 *
 * PURPOSE
 * These tests hit a REAL Supabase instance (local, via `supabase start`) and
 * authenticate as real users — unlike your existing unit tests, nothing here
 * is mocked. This is what actually proves RLS policies work, since RLS only
 * activates for requests made with a user's JWT (the anon/authenticated
 * role), never for the service-role key.
 *
 * PREREQUISITES
 * 1. `supabase start` running locally (or point env vars at a disposable
 *    staging project — never run this against production).
 * 2. .env.test (or your test env loader) providing:
 *      SUPABASE_URL
 *      SUPABASE_ANON_KEY
 *      SUPABASE_SERVICE_ROLE_KEY
 * 3. Migrations 001–007 already applied to that instance.
 *
 * These are marked as a separate suite (see vitest config note at bottom)
 * so they don't run as part of the fast unit-test loop, and can be gated
 * behind `npm run test:integration` in CI.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "RLS integration tests require SUPABASE_URL, SUPABASE_ANON_KEY, and " +
      "SUPABASE_SERVICE_ROLE_KEY to be set (see file header for setup).",
  );
}

// Admin client: bypasses RLS, used ONLY for fixture setup/teardown.
const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TenantFixture {
  orgId: string;
  branchId: string;
  userId: string;
  email: string;
  password: string;
  client: SupabaseClient; // signed in AS this user, subject to RLS
  repairOrderId: string;
}

async function createTenantFixture(label: string): Promise<TenantFixture> {
  const suffix = randomUUID().slice(0, 8);
  const email = `rls-test-${label}-${suffix}@example.test`;
  const password = `Test-${suffix}!`;

  // 1. Create org + branch (adjust column names to match your schema).
  const { data: org, error: orgErr } = await admin
    .from("organisations")
    .insert({
      name: `RLS Test Org ${label} ${suffix}`,
      slug: `rls-test-org-${label}-${suffix}`,
    })
    .select("id")
    .single();
  if (orgErr) throw orgErr;

  const { data: branch, error: branchErr } = await admin
    .from("branches")
    .insert({
      organisation_id: org.id,
      name: `Branch ${label}`,
      code: `RLS-${label.toUpperCase()}-${suffix}`,
    })
    .select("id")
    .single();
  if (branchErr) throw branchErr;

  // 2. Create auth user + profile + membership.
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) throw authErr;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: authUser.user.id,
    display_name: `RLS Test User ${label}`,
  });
  if (profileErr) throw profileErr;

  const { error: organisationMembershipErr } = await admin
    .from("organisation_memberships")
    .insert({
      profile_id: authUser.user.id,
      organisation_id: org.id,
    });
  if (organisationMembershipErr) throw organisationMembershipErr;

  const { error: branchMembershipErr } = await admin
    .from("branch_memberships")
    .insert({
      profile_id: authUser.user.id,
      organisation_id: org.id,
      branch_id: branch.id,
    });
  if (branchMembershipErr) throw branchMembershipErr;

  // 3. Seed one repair order owned by this org/branch.
  const { data: repairOrder, error: roErr } = await admin
    .from("repair_orders")
    .insert({
      organisation_id: org.id,
      branch_id: branch.id,
      ro_number: `RO-${suffix}`,
      lifecycle_status: "intake",
      primary_repair_stage: null,
      created_by: authUser.user.id,
    })
    .select("id")
    .single();
  if (roErr) throw roErr;

  // 4. Sign in as this user with the ANON client (this client is what
  //    respects RLS — admin/service-role never does).
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;

  return {
    orgId: org.id,
    branchId: branch.id,
    userId: authUser.user.id,
    email,
    password,
    client,
    repairOrderId: repairOrder.id,
  };
}

async function cleanupTenantFixture(fixture: TenantFixture | undefined) {
  if (!fixture) return;

  await admin.from("repair_orders").delete().eq("id", fixture.repairOrderId);
  await admin
    .from("branch_memberships")
    .delete()
    .eq("profile_id", fixture.userId);
  await admin
    .from("organisation_memberships")
    .delete()
    .eq("profile_id", fixture.userId);
  await admin.auth.admin.deleteUser(fixture.userId);
  await admin.from("branches").delete().eq("id", fixture.branchId);
  await admin.from("organisations").delete().eq("id", fixture.orgId);
}

describe("RLS: cross-tenant isolation on repair_orders", () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    [tenantA, tenantB] = await Promise.all([
      createTenantFixture("a"),
      createTenantFixture("b"),
    ]);
  }, 30_000);

  afterAll(async () => {
    await Promise.all([
      cleanupTenantFixture(tenantA),
      cleanupTenantFixture(tenantB),
    ]);
  });

  it("allows a user to read their own org's repair order", async () => {
    const { data, error } = await tenantA.client
      .from("repair_orders")
      .select("id")
      .eq("id", tenantA.repairOrderId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(tenantA.repairOrderId);
  });

  it("blocks a user from reading another org's repair order", async () => {
    const { data, error } = await tenantA.client
      .from("repair_orders")
      .select("id")
      .eq("id", tenantB.repairOrderId)
      .maybeSingle();

    // With RLS working correctly, this should NOT error — it should
    // simply return no rows (RLS filters, it doesn't throw).
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("blocks a user from listing repair orders across orgs", async () => {
    const { data, error } = await tenantA.client
      .from("repair_orders")
      .select("id");

    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(tenantA.repairOrderId);
    expect(ids).not.toContain(tenantB.repairOrderId);
  });

  it("blocks a user from updating another org's repair order", async () => {
    const { data, error } = await tenantA.client
      .from("repair_orders")
      .update({
        lifecycle_status: "cancelled",
        primary_repair_stage: null,
      })
      .eq("id", tenantB.repairOrderId)
      .select("id");

    // RLS should prevent the row from being matched at all — update
    // affects 0 rows rather than throwing (unless you also enforce a
    // WITH CHECK failure, in which case assert on `error` instead).
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("blocks a user from inserting a repair order into another org", async () => {
    const { error } = await tenantA.client.from("repair_orders").insert({
      organisation_id: tenantB.orgId, // attempting to write into org B
      branch_id: tenantB.branchId,
      ro_number: `RO-forged-${randomUUID().slice(0, 6)}`,
      lifecycle_status: "intake",
      primary_repair_stage: null,
      created_by: tenantA.userId,
    });

    // This SHOULD error — the WITH CHECK clause on the insert policy
    // must reject a row whose organisation_id doesn't match the caller's
    // membership. If this assertion fails, your insert policy has a gap.
    expect(error).not.toBeNull();
  });

  it.todo("blocks cross-branch access within the same org when branch-scoped");
});

/**
 * VITEST CONFIG NOTE
 * Add a separate script + config so these don't run on every `npm run test`:
 *
 *   // package.json
 *   "test:integration": "vitest run --config vitest.integration.config.mjs"
 *
 *   // vitest.integration.config.mjs
 *   export default defineConfig({
 *     test: { include: ["tests/integration/**\/*.test.ts"], testTimeout: 30000 },
 *   });
 *
 * And exclude tests/integration/** from your default vitest.config.mjs
 * `include`/`exclude` so the unit-test run stays fast and mock-based.
 */
