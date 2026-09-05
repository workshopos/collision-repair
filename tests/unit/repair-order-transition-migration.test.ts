import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905000001_reconcile_repair_order_lifecycle.sql",
  ),
  "utf8",
);

describe("Repair order transition migration", () => {
  it("uses the canonical lifecycle history columns and tenant scope parameters", () => {
    expect(migration).toContain(
      "from_lifecycle_status,\n    from_primary_stage,\n    to_lifecycle_status,\n    to_primary_stage,",
    );
    expect(migration).toContain("p_organisation_id uuid,\n  p_branch_id uuid,");
    expect(migration).toContain(
      "from public.repair_orders\n  where id = p_repair_order_id\n  for update;",
    );
    expect(migration).toContain(
      "if v_row.organisation_id <> p_organisation_id\n     or v_row.branch_id <> p_branch_id then",
    );
    expect(migration).toContain(
      "raise exception 'Repair order tenant scope does not match' using errcode = 'P0001';",
    );
    expect(migration).toContain(
      "drop index if exists public.idx_repair_orders_status;",
    );
    expect(migration).toContain("drop column legacy_status;");
  });

  it("drops legacy overloads and restricts the canonical RPC to service_role", () => {
    expect(migration).toContain(
      "drop function if exists public.transition_repair_order(uuid, uuid, uuid, text, uuid);",
    );
    expect(migration).toContain(
      "drop function if exists public.transition_repair_order(\n  uuid,\n  text,\n  uuid,\n  public.repair_order_primary_stage,\n  text\n );",
    );
    expect(migration).toContain(
      "revoke all on function public.transition_repair_order(\n  uuid, text, uuid, uuid, uuid, public.repair_order_primary_stage, text\n) from public;",
    );
    expect(migration).toContain(
      "revoke execute on function public.transition_repair_order(\n  uuid, text, uuid, uuid, uuid, public.repair_order_primary_stage, text\n) from authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.transition_repair_order(\n  uuid, text, uuid, uuid, uuid, public.repair_order_primary_stage, text\n) to service_role;",
    );
  });
});
