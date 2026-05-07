# AGENTS.md

Scoped guidance for `tooling/typescript` (`@ctrlplane/tsconfig`). Inherit the
root instructions first.

## Purpose

This package provides shared TypeScript configuration used across the monorepo.

## Layout

- `base.json`: strict base config for TypeScript and JS checking.
- `internal-package.json`: package build config extending the base.

## Conventions

- Treat compiler option changes as repo-wide behavior changes.
- Preserve strictness unless there is a clear migration plan.
- Keep path/module settings compatible with package build tooling and ESM usage.
- Avoid adding package-specific exceptions here; prefer local `tsconfig.json`
  overrides.

## Verification

- Run `pnpm typecheck` or targeted representative package typechecks after
  changing shared TypeScript config.
