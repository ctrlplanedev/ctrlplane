# AGENTS.md

Scoped guidance for `tooling/openapi` (`@ctrlplane/openapi-merge`). Inherit the
root instructions first.

## Purpose

This package contains tooling for scanning TypeScript OpenAPI specs and merging
them into a single OpenAPI document.

## Layout

- `merge.ts`: glob-based spec discovery, import, merge, and output writing.

## Commands

- `pnpm -F @ctrlplane/openapi-merge merge`: run the merge tool.
- `pnpm -F @ctrlplane/openapi-merge lint`: run ESLint.
- `pnpm -F @ctrlplane/openapi-merge typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/openapi-merge format`: check formatting.
- `pnpm -F @ctrlplane/openapi-merge clean`: remove build/cache output.

## Conventions

- Check current paths before relying on the existing glob; it may reference
  older app locations.
- Keep merge output deterministic by sorting discovered files.
- Surface merge/import failures clearly because this tool is usually run during
  generation workflows.

## Verification

- Run `pnpm -F @ctrlplane/openapi-merge typecheck` and `merge` after tool
  changes.
