# AGENTS.md

Scoped guidance for `packages/secrets` (`@ctrlplane/secrets`). Inherit the root
instructions first.

## Purpose

This package provides secret encryption/decryption helpers for variable values
using an AES-256 key from validated environment config.

## Layout

- `src/index.ts`: env validation, AES-256 encryption service, and
  `variablesAES256` factory.

## Commands

- `pnpm -F @ctrlplane/secrets build`: build the package.
- `pnpm -F @ctrlplane/secrets dev`: watch build.
- `pnpm -F @ctrlplane/secrets lint`: run ESLint.
- `pnpm -F @ctrlplane/secrets typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/secrets format`: check formatting.

## Conventions

- Do not log plaintext secrets, encrypted payloads when avoidable, or key
  material.
- Preserve encrypted payload compatibility unless coordinating migration logic.
- Keep env validation strict for key length and format.
- Prefer adding tests before changing encryption format, IV handling, or key
  derivation behavior.

## Verification

- Run `pnpm -F @ctrlplane/secrets typecheck` and `lint`.
- For crypto behavior changes, verify round-trip encryption/decryption and
  backward compatibility with existing encrypted values.
