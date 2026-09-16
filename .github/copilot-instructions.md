# WorkShopOS — Persistent Agent Rules

## Source of truth (read before any code change)
1. MVP_DIRECTIVE.md — scope, phases, quota rules, definition of done
2. ARCHITECTURE.md — stack, layers, modules, security rules
3. DATABASE.md / REMEDIATION_PLAN.md / BUILD_STATUS.md — if present

## Hard rules
- INSPECT BEFORE CHANGING: read existing files, migrations, tests, BUILD_STATUS.md first.
- Never create a file/component/hook/util that already exists. Reuse, don't duplicate.
- Never rewrite whole files when a targeted edit works.
- One phase per task. Small diffs. No speculative features.
- Stack only: Next.js + TypeScript + Tailwind + shadcn/ui + Supabase + React Query + Zod.
  No new dependencies without explicit approval + justification.
- $0 budget: free tiers only (Supabase free, Vercel free, GitHub Actions free).
  No paid APIs, no premium UI kits, no new infrastructure.
- Security: RLS mandatory, server-side validation with Zod, never trust the client,
  never expose service-role keys, never hardcode secrets.
- Money: NUMERIC in DB, no float arithmetic. Photos/docs in Supabase Storage, never in DB.
- After every change: report in format
  **Observed → Verified → Changed → Tested → Result → Next action**
- Never claim "fixed/applied/passing" without showing command output as evidence.