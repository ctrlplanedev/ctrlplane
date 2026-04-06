---
name: No generation scripts
description: Don't run generation/migration scripts (pnpm generate, etc) — user runs those manually
type: feedback
---

Do not run generation scripts like `pnpm generate`, `pnpm build`, or migration commands during implementation.

**Why:** User prefers to run these themselves to maintain control over generated output.

**How to apply:** Make the schema/code changes, then tell the user which scripts to run.
