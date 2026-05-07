# AGENTS.md

Scoped guidance for `tooling/tailwind` (`@ctrlplane/tailwind-config`). Inherit
the root instructions first.

## Purpose

This package provides shared Tailwind presets for web and native consumers.

## Layout

- `base.ts`: shared theme tokens and content defaults.
- `web.ts`: web preset with container, radius, accordion animation, and plugins.
- `native.ts`: native preset layered on the base config.

## Commands

- `pnpm -F @ctrlplane/tailwind-config lint`: run ESLint.
- `pnpm -F @ctrlplane/tailwind-config typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/tailwind-config format`: check formatting.
- `pnpm -F @ctrlplane/tailwind-config clean`: remove build/cache output.

## Conventions

- Shared token changes affect all UI packages. Prefer additive changes over
  renaming/removing tokens.
- Keep config exports stable: `./web` and `./native`.
- Check content globs before adding utilities that depend on scanning new file
  locations.

## Verification

- Run package typecheck and lint.
- For visual token changes, verify at least `apps/web` still builds and renders
  expected styles.
