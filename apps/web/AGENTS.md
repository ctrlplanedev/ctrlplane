# AGENTS.md

Scoped guidance for `apps/web` (`@ctrlplane/web`). Inherit the root
instructions first.

## Purpose

This is the React frontend. It uses React Router v7 in framework mode with
client-side rendering only, tRPC as the primary API layer, and typed
OpenAPI-fetch calls for REST-only endpoints.

## Layout

- `app/root.tsx`: HTML shell and top-level providers.
- `app/routes.ts`: explicit route tree. A route file is not active unless it is
  registered here.
- `app/routes`: route components. `routes/ws` is the authenticated workspace UI.
- `app/api/trpc.tsx`: tRPC React client and React Query setup.
- `app/api/openapi-client.ts`: typed REST client factory.
- `app/api/openapi.ts`: generated REST types from `apps/api`.
- `app/components/ui`: shadcn/Radix primitives.
- `app/components/WorkspaceProvider.tsx`: workspace context and `useWorkspace`.
- `CONTRIBUTING.md`: detailed frontend recipes and conventions.

## Commands

- `pnpm -F @ctrlplane/web dev`: run the Vite dev server.
- `pnpm -F @ctrlplane/web build`: build the app.
- `pnpm -F @ctrlplane/web start`: serve the built app.
- `pnpm -F @ctrlplane/web typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/web generate`: regenerate `app/api/openapi.ts`.

## Conventions

- Keep routes explicit in `app/routes.ts`.
- Use the `~/` alias for imports from `app`; use relative imports only for
  closely co-located files.
- Use tRPC from `~/api/trpc` for most data access. Add procedures in
  `packages/trpc`.
- Use `createClient` from `~/api/openapi-client` for REST-only endpoints.
- Access workspace state through `useWorkspace()` inside workspace routes.
- Use existing shadcn/Radix UI primitives and Tailwind tokens before adding new
  component systems.
- Do not use SSR-only React Router APIs; `react-router.config.ts` has
  `ssr: false`.
- Do not hand-edit generated `app/api/openapi.ts`.

## Verification

- Run `pnpm -F @ctrlplane/web typecheck` for TypeScript or route changes.
- Run `pnpm -F @ctrlplane/web generate` after API OpenAPI spec changes.
