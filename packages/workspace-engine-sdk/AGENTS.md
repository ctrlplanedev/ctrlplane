# AGENTS.md

Scoped guidance for `packages/workspace-engine-sdk`
(`@ctrlplane/workspace-engine-sdk`). Inherit the root instructions first.

## Purpose

This package provides a typed OpenAPI client for `apps/workspace-engine` and
exports generated workspace-engine API types.

## Layout

- `src/index.ts`: `openapi-fetch` client factory, cached default client, and
  type exports.
- `src/config.ts`: validated `WORKSPACE_ENGINE_URL` config.
- `src/schema.ts`: generated OpenAPI TypeScript types. Do not hand-edit.

## Commands

- `pnpm -F @ctrlplane/workspace-engine-sdk build`: build with tsup.
- `pnpm -F @ctrlplane/workspace-engine-sdk build:tsc`: run declaration build.
- `pnpm -F @ctrlplane/workspace-engine-sdk dev`: watch build.
- `pnpm -F @ctrlplane/workspace-engine-sdk lint`: run ESLint.
- `pnpm -F @ctrlplane/workspace-engine-sdk typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/workspace-engine-sdk generate`: regenerate OpenAPI types.
- `pnpm -F @ctrlplane/workspace-engine-sdk format:fix`: fix formatting.

## Conventions

- Regenerate `src/schema.ts` from the workspace-engine OpenAPI spec instead of
  editing it manually.
- Keep `createClient` generic and side-effect-light.
- Be careful with `getClientFor`; changing cache/header behavior affects all
  consumers.
- Keep env config minimal and server-side.

## Verification

- Run `pnpm -F @ctrlplane/workspace-engine-sdk generate` after
  workspace-engine API spec changes.
- Run `pnpm -F @ctrlplane/workspace-engine-sdk typecheck` and `build`.
