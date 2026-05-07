# AGENTS.md

Scoped guidance for `apps/api` (`@ctrlplane/web-api`). Inherit the root
instructions first.

## Purpose

This is the Express API service. It owns the synchronous request/response
surface for REST, tRPC mounting, auth, and inbound webhooks. Long-running
release planning, policy evaluation, and job dispatch should be represented as
database writes plus reconciliation work for `apps/workspace-engine`, not
performed inline here.

## Layout

- `src/server.ts`: Express app wiring, middleware, OpenAPI validation,
  better-auth, webhook routers, and tRPC adapter.
- `src/routes/v1`: REST routers validated against `openapi/openapi.json`.
- `src/routes/github`, `src/routes/tfe`, `src/routes/argoworkflow`: webhook
  routers that intentionally bypass OpenAPI request validation.
- `src/middleware/auth.ts`: API key/session auth and `req.apiContext`.
- `src/types/api.ts`: typed OpenAPI handler helpers and API error classes.
- `openapi`: Jsonnet OpenAPI sources. `openapi/openapi.json` and
  `src/types/openapi.ts` are generated.
- `CONTRIBUTING.md`: detailed API recipes. Prefer it over the stale `README.md`.

## Commands

- `pnpm -F @ctrlplane/web-api dev`: run the API with env loading.
- `pnpm -F @ctrlplane/web-api build`: compile the package.
- `pnpm -F @ctrlplane/web-api typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/web-api lint`: run ESLint.
- `pnpm -F @ctrlplane/web-api format`: check formatting.
- `pnpm -F @ctrlplane/web-api generate`: regenerate OpenAPI artifacts.

## Conventions

- REST is OpenAPI-first. Update Jsonnet specs before route types and regenerate.
- Use `AsyncTypedHandler<Path, Method>` plus `asyncHandler` for REST handlers.
- `req.apiContext!` is only valid behind `requireAuth`.
- Add tRPC procedures in `packages/trpc`, not in this package.
- Webhook handlers should verify provider signatures, validate payloads, write
  state, enqueue reconciliation, and return quickly.
- Do not hand-edit generated OpenAPI output unless debugging a generation issue.

## Verification

- For REST changes, run `pnpm -F @ctrlplane/web-api generate` and
  `pnpm -F @ctrlplane/web-api typecheck`.
- For behavior changes, prefer E2E coverage in `e2e/tests/api`.
