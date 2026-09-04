import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260901000005_repair_order_transition_slice.sql",
  ),
  "utf8",
);

describe("Repair order transition migration", () => {
  it("rejects RPC calls whose organisation or branch does not match the locked row", () => {
    expect(migration).toContain("p_organisation_id uuid,\n  p_branch_id uuid,");
    expect(migration).toContain(
      "from public.repair_orders\n   where id = p_repair_order_id\n   for update;",
    );
    expect(migration).toContain(
      "if v_row.organisation_id <> p_organisation_id or v_row.branch_id <> p_branch_id then",
    );
    expect(migration).toContain(
      "raise exception 'Repair order tenant scope does not match' using errcode = 'P0001';",
    );
  });

  it("restricts the updated RPC signature to service_role", () => {
    expect(migration).toContain(
      "revoke all on function public.transition_repair_order(uuid, uuid, uuid, text, uuid) from public;",
    );
    expect(migration).toContain(
      "revoke execute on function public.transition_repair_order(uuid, uuid, uuid, text, uuid) from authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.transition_repair_order(uuid, uuid, uuid, text, uuid) to service_role;",
    );
  });
});
