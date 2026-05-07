# AGENTS.md

Scoped guidance for `packages/logger` (`@ctrlplane/logger`). Inherit the root
instructions first.

## Purpose

This package provides the shared Winston logger plus OpenTelemetry helper
exports and span-wrapping utilities.

## Layout

- `src/index.ts`: logger construction, OpenTelemetry type/helpers exports, and
  `makeWithSpan`.

## Commands

- `pnpm -F @ctrlplane/logger build`: build the package.
- `pnpm -F @ctrlplane/logger dev`: watch build.
- `pnpm -F @ctrlplane/logger lint`: run ESLint.
- `pnpm -F @ctrlplane/logger typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/logger format`: check formatting.

## Conventions

- Keep logging output safe for production; avoid serializing secrets or large
  payloads by default.
- Preserve `LOG_LEVEL` behavior unless coordinating an operational change.
- Keep OpenTelemetry helpers generic; package consumers should choose span
  names and attributes.
- Be cautious changing log format because downstream tooling may parse it.

## Verification

- Run `pnpm -F @ctrlplane/logger typecheck` and `lint`.
- For format changes, inspect sample output in development and production mode.
