@AGENTS.md

## Progress checklist

- [x] Project instructions are linked and available.
- [x] Stage 9+ repair-order module is complete: read, list, create, update, and archive are implemented and verified.
- [x] Repair-order workflow/status transition endpoint is implemented and verified, including atomic transition history, tenant-scope defense-in-depth, and service-role-only RPC execution.
- [ ] Next actionable feature slice: implement and verify the repair-order service layer, beginning with the existing operations and transition-history retrieval defined in PRD Stage 20.
- [ ] RLS/RBAC real-data verification remains infrastructure-blocked pending the local database environment needed for live seeded-role validation.
