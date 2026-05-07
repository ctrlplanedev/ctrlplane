# AGENTS.md

Scoped guidance for `packages/trpc` (`@ctrlplane/trpc`). Inherit the root
instructions first.

## Purpose

This package defines the tRPC router used by the web app and mounted by
`apps/api`. It is the primary typed application API for the React frontend.

## Layout

- `src/trpc.ts`: context creation, public/protected procedures, SuperJSON, and
  authorization middleware.
- `src/root.ts`: `appRouter` composition.
- `src/routes`: domain routers for workspace, resources, deployments, policies,
  jobs, workflows, and related entities.
- `src/index.ts`: package exports.

## Commands

- `pnpm -F @ctrlplane/trpc build`: build the package.
- `pnpm -F @ctrlplane/trpc dev`: watch build.
- `pnpm -F @ctrlplane/trpc lint`: run ESLint.
- `pnpm -F @ctrlplane/trpc typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/trpc format`: check formatting.

## Conventions

- Use `protectedProcedure` for authenticated application data unless a procedure
  is intentionally public.
- Add `meta.authorizationCheck` for permissioned operations.
- Use Zod input schemas at procedure boundaries.
- Use `ctx.db` rather than importing the shared db directly inside procedures
  when practical.
- Enqueue workspace-engine reconciliation after writes that affect derived
  release, selector, policy, job, or relationship state.
- Keep `appRouter` exports stable because `apps/web` consumes its type.

## Verification

- Run `pnpm -F @ctrlplane/trpc typecheck` for procedure changes.
- For behavior changes, add API/E2E tests in `e2e/tests/api` when there is no
  local unit-test harness.
