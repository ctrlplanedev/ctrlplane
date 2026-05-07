# AGENTS.md

Scoped guidance for `tooling/prettier` (`@ctrlplane/prettier-config`). Inherit
the root instructions first.

## Purpose

This package provides the shared Prettier config, including import sorting and
Tailwind class sorting.

## Layout

- `index.js`: exported Prettier config.

## Commands

- `pnpm -F @ctrlplane/prettier-config typecheck`: typecheck config JS.
- `pnpm -F @ctrlplane/prettier-config format`: check formatting.
- `pnpm -F @ctrlplane/prettier-config clean`: remove build/cache output.

## Conventions

- Treat import order changes as repo-wide churn. Avoid changing ordering unless
  the benefit justifies broad diffs.
- Keep `tailwindConfig` pointed at the shared web Tailwind config unless moving
  that config intentionally.
- Preserve plugin compatibility with the pinned Prettier version.

## Verification

- Run package typecheck and format.
- For import-order changes, run formatting on a small representative package
  before applying repo-wide fixes.
