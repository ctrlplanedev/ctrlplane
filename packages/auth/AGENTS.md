# AGENTS.md

Scoped guidance for `packages/auth` (`@ctrlplane/auth`). Inherit the root
instructions first.

## Purpose

This package wraps better-auth, OAuth/provider configuration, client-safe auth
exports, server auth exports, and RBAC permission helpers.

## Layout

- `src/better`: better-auth client/server/config exports.
- `src/env.ts`: validated auth/email environment config.
- `src/utils`: API key, credential, RBAC, and permission-check helpers.
- `src/index.ts`: client-safe exports only.
- `src/index.rsc.ts`: React Server Component-safe exports.

## Commands

- `pnpm -F @ctrlplane/auth build`: build the package.
- `pnpm -F @ctrlplane/auth dev`: watch build.
- `pnpm -F @ctrlplane/auth lint`: run ESLint.
- `pnpm -F @ctrlplane/auth typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/auth format`: check formatting.

## Conventions

- Keep server-only code out of client-safe exports.
- Add environment variables through `src/env.ts` with validation and safe
  defaults only when appropriate.
- Preserve API-key and session auth semantics used by `apps/api`.
- RBAC helpers should keep scope hierarchy behavior explicit and tested when
  modified.
- Be careful with auth hooks that write database state; they run during login
  and session flows.

## Verification

- Run `pnpm -F @ctrlplane/auth typecheck` and `lint` for auth changes.
- For RBAC behavior changes, add or update focused tests in the consumer layer
  if this package has no local test harness for the path.
