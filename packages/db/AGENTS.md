# AGENTS.md

Scoped guidance for `packages/db` (`@ctrlplane/db`). Inherit the root
instructions first.

## Purpose

This package owns Drizzle schema definitions, migrations, database client setup,
and helper functions for enqueueing workspace-engine reconciliation work.

## Layout

- `src/schema`: Drizzle table definitions and schema exports.
- `src/client.ts`: shared `pg` pool and Drizzle client.
- `src/config.ts`: validated database environment config.
- `src/reconcilers`: helpers that enqueue work into `reconcile_work_scope`.
- `drizzle`: generated migration SQL and Drizzle metadata.
- `drizzle.config.ts`: Drizzle Kit config.

## Commands

- `pnpm -F @ctrlplane/db build`: build the package.
- `pnpm -F @ctrlplane/db typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/db lint`: run ESLint.
- `pnpm -F @ctrlplane/db format`: check formatting.
- `pnpm -F @ctrlplane/db generate`: generate Drizzle migrations.
- `pnpm -F @ctrlplane/db migrate`: apply migrations.
- `pnpm -F @ctrlplane/db push`: push schema changes directly in dev.
- `pnpm -F @ctrlplane/db studio`: open Drizzle Studio.

## Conventions

- Schema source lives in `src/schema`; do not model database behavior only in
  migrations.
- Prefer generated migrations from Drizzle Kit over hand-written migration SQL.
- Preserve workspace isolation. Workspace-scoped tables should carry
  `workspaceId` and queries should filter by workspace where applicable.
- Keep reconcile enqueue helpers idempotent and conflict-safe.
- Be cautious with migration edits after they may have been applied elsewhere.

## Verification

- Run `pnpm -F @ctrlplane/db typecheck` after schema/helper changes.
- For schema changes, run `pnpm -F @ctrlplane/db generate` and inspect the
  generated migration before committing.
- Apply migrations locally with `pnpm -F @ctrlplane/db migrate` when behavior
  depends on database shape.
