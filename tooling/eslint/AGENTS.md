# AGENTS.md

Scoped guidance for `tooling/eslint` (`@ctrlplane/eslint-config`). Inherit the
root instructions first.

## Purpose

This package provides shared flat ESLint configs for TypeScript packages and
React packages.

## Layout

- `base.js`: shared TypeScript/import/vitest rules plus helper configs such as
  `requireJsSuffix` and `restrictEnvAccess`.
- `react.js`: React and React Hooks rule layer.
- `types.d.ts`: local type declarations for config imports.

## Commands

- `pnpm -F @ctrlplane/eslint-config typecheck`: typecheck config files.
- `pnpm -F @ctrlplane/eslint-config format`: check formatting.
- `pnpm -F @ctrlplane/eslint-config clean`: remove build/cache output.

## Conventions

- Treat rule changes as repo-wide behavior changes.
- Keep exports stable for packages importing `@ctrlplane/eslint-config/base` or
  `/react`.
- Prefer narrowly scoped overrides over disabling strict rules globally.
- When changing `restrictEnvAccess`, check packages that intentionally validate
  env through `@t3-oss/env-core`.

## Verification

- Run package typecheck and at least one representative consumer lint when
  changing shared rules.
