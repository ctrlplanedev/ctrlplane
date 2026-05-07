# AGENTS.md

Scoped guidance for `packages/validators` (`@ctrlplane/validators`). Inherit
the root instructions first.

## Purpose

This package contains shared Zod schemas and validation helpers for auth,
resources, releases, events, jobs, variables, GitHub integration payloads,
conditions, deployments, and environments.

## Layout

- `src/index.ts`: top-level exports.
- `src/resources`, `src/deployments`, `src/environments`, `src/jobs`,
  `src/releases`: domain schemas and condition schemas.
- `src/conditions`: shared condition primitives.
- `src/events`, `src/session`, `src/auth`, `src/github`, `src/variables`:
  specialized schemas.

## Commands

- `pnpm -F @ctrlplane/validators build`: build the package.
- `pnpm -F @ctrlplane/validators dev`: watch build.
- `pnpm -F @ctrlplane/validators lint`: run ESLint.
- `pnpm -F @ctrlplane/validators typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/validators format`: check formatting.

## Conventions

- Keep schemas reusable across API, web, and database packages.
- Export new public schemas through the relevant domain `index.ts` and the
  package export map when needed.
- Treat schema tightening as a compatibility-sensitive change because it can
  reject existing API/client payloads.
- Keep condition schemas aligned with selector/policy semantics in API and
  workspace-engine code.

## Verification

- Run `pnpm -F @ctrlplane/validators typecheck` and `lint`.
- Add focused validation tests in consumers when schema behavior changes and no
  local test harness exists.
