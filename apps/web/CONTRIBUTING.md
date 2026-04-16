# Contributing to `apps/web`

This is the service guide for `apps/web` — the React frontend. It assumes you've completed the root [CONTRIBUTING.md](../../CONTRIBUTING.md) setup and can run `pnpm dev`. The web app is served at **http://localhost:5173**.

## Table of Contents

- [Stack Overview](#stack-overview)
- [Directory Layout](#directory-layout)
- [Routing Conventions](#routing-conventions)
- [Recipes](#recipes)
  - [Add a new page](#add-a-new-page)
  - [Fetch data with tRPC](#fetch-data-with-trpc)
  - [Call the REST API with openapi-fetch](#call-the-rest-api-with-openapi-fetch)
  - [Build a form](#build-a-form)
  - [Store state in the URL](#store-state-in-the-url)
  - [Access the current workspace](#access-the-current-workspace)
  - [Add a shadcn UI component](#add-a-shadcn-ui-component)
- [Styling](#styling)
- [Common Pitfalls](#common-pitfalls)

## Stack Overview

| Layer              | Choice                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| Framework          | [React Router v7](https://reactrouter.com/) (framework mode, **client-only**, no SSR)  |
| Build              | [Vite](https://vitejs.dev/) + [vite-tsconfig-paths](https://github.com/aleclarson/vite-tsconfig-paths) |
| UI components      | [shadcn/ui](https://ui.shadcn.com/) on top of [Radix](https://www.radix-ui.com/)       |
| Styling            | [Tailwind CSS v4](https://tailwindcss.com/)                                            |
| Icons              | [Lucide](https://lucide.dev/) (main) + [react-simple-icons](https://simpleicons.org/)  |
| tRPC (primary API) | [`@trpc/react-query`](https://trpc.io/) with SuperJSON                                 |
| REST (secondary)   | [`openapi-fetch`](https://openapi-ts.pages.dev/openapi-fetch/) typed from `apps/api`'s OpenAPI |
| Auth client        | [better-auth](https://www.better-auth.com/) (`authClient` singleton)                   |
| Forms              | [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) (`@hookform/resolvers`) |
| URL state          | [nuqs](https://nuqs.47ng.com/) + React Router's `useSearchParams`                      |
| Graph viz          | [ReactFlow](https://reactflow.dev/) + [dagre](https://github.com/dagrejs/dagre) layout |
| Code editor        | [Monaco](https://microsoft.github.io/monaco-editor/) (for CEL selectors, JSON configs) |

**Client-only, not SSR.** `react-router.config.ts` sets `{ ssr: false }` — every page renders in the browser. Don't reach for SSR-specific APIs; don't worry about hydration mismatches.

## Directory Layout

```text
apps/web/
├── app/
│   ├── root.tsx                  # HTML shell, providers (TRPCReactProvider, ThemeProvider)
│   ├── routes.ts                 # Explicit route tree — every route is registered here
│   ├── app.css                   # Tailwind entry
│   ├── api/
│   │   ├── trpc.tsx              # trpc client + TRPCReactProvider
│   │   ├── openapi-client.ts     # openapi-fetch client factory
│   │   ├── openapi.ts            # Generated from apps/api/openapi/openapi.json
│   │   └── auth-client.ts        # better-auth client
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (button, dialog, form, …)
│   │   ├── WorkspaceProvider.tsx # useWorkspace() context
│   │   ├── ThemeProvider.tsx     # dark/light mode
│   │   └── config-entry.tsx      # shared app-level components
│   ├── hooks/                    # Cross-cutting hooks (use-mobile, …)
│   ├── lib/
│   │   └── utils.ts              # cn() and other helpers
│   └── routes/
│       ├── auth/                 # /login, /sign-up (unauthenticated)
│       ├── protected.tsx         # Auth gate — every route below requires a session
│       ├── workspaces/           # /workspaces/create
│       └── ws/                   # /:workspaceSlug/* — the main app
│           ├── _layout.tsx       # Sidebar, topbar, workspace switcher
│           ├── _components/      # Layout-level shared components
│           ├── deployments/      # Route + sub-routes for /:ws/deployments/*
│           ├── environments/
│           ├── resources/
│           ├── …
│           └── settings/
├── public/
├── react-router.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── components.json               # shadcn/ui config (where `pnpm ui-add` writes)
```

**Import alias**: `~/` → `app/`. Use it for everything in-app; only use relative paths for truly co-located files in the same directory.

## Routing Conventions

Routes are declared **explicitly** in `app/routes.ts`. There's no file-based routing magic — if a file isn't listed in `routes.ts`, it's not a route.

- **`_layout.tsx`** — a layout route. Renders an `<Outlet />` for children; does not show as a page on its own. Use when multiple sibling routes share a shell (sidebar, tabs, etc.).
- **Underscore-prefixed folders** like `_components/` and `_hooks/` — not routes. Safe locations for co-located components and hooks specific to the feature.
- **`page.$paramName.tsx`** — convention for pages with a URL parameter (e.g. `page.$deploymentId.tsx` for `/:deploymentId`). The actual URL segment comes from the string passed to `route(...)` in `routes.ts`; the filename is just a convention.
- **Auth gating**: `protected.tsx` wraps every authenticated route. It calls `trpc.user.session.useQuery()`, redirects to `/login` if unauthenticated, and handles workspace resolution before rendering children.

## Recipes

### Add a new page

Suppose you're adding `/:workspaceSlug/foos`.

**1. Create the route component.** Default-export a React component from `app/routes/ws/foos.tsx`:

```tsx
// app/routes/ws/foos.tsx
import { useWorkspace } from "~/components/WorkspaceProvider";
import { trpc } from "~/api/trpc";

export function meta() {
  return [{ title: "Foos - Ctrlplane" }];
}

export default function FoosPage() {
  const { workspace } = useWorkspace();
  const { data: foos, isLoading } = trpc.foo.list.useQuery({
    workspaceId: workspace.id,
  });

  if (isLoading) return <div>Loading…</div>;
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Foos</h1>
      <ul>{foos?.map((f) => <li key={f.id}>{f.name}</li>)}</ul>
    </div>
  );
}
```

**2. Register it in `routes.ts`** — inside the `ws/_layout.tsx` children:

```ts
route(":workspaceSlug", "routes/ws/_layout.tsx", [
  // …existing routes
  route("foos", "routes/ws/foos.tsx"),
]),
```

**3. Add a sidebar link** in `app/routes/ws/_layout.tsx` if the page should be user-discoverable.

If the page has sub-routes (e.g. `/foos/:id`, `/foos/:id/settings`), add a sibling `route("foos", "routes/ws/foos/_layout.tsx", [...])` entry — see the `deployments` tree for the pattern.

### Fetch data with tRPC

The main data layer is tRPC. Procedures live in `packages/trpc`; the client is imported from `~/api/trpc`:

```tsx
import { trpc } from "~/api/trpc";

const { data, isLoading, error } = trpc.deployment.list.useQuery({
  workspaceId: workspace.id,
});

const createDeployment = trpc.deployment.create.useMutation({
  onSuccess: () => {
    // invalidate cached queries on success
    utils.deployment.list.invalidate();
  },
});

createDeployment.mutate({ name: "api", workspaceId: workspace.id });
```

**Cache invalidation** uses `trpc.useUtils()`:

```tsx
const utils = trpc.useUtils();
// later…
await utils.deployment.list.invalidate({ workspaceId: workspace.id });
```

The default `staleTime` is 5 seconds (see `createQueryClient` in `app/api/trpc.tsx`), so refetches happen aggressively. Bump `staleTime` in individual queries if you're displaying data that doesn't need to be instantly fresh.

**To add a new procedure**, that's a change to `packages/trpc` — not to this app. The client picks it up automatically via the `AppRouter` type import.

### Call the REST API with openapi-fetch

For endpoints that exist only on REST (not tRPC), use the typed `openapi-fetch` client:

```tsx
import { createClient } from "~/api/openapi-client";

const api = createClient({ baseUrl: "/api" });

const { data, error } = await api.GET(
  "/v1/workspaces/{workspaceId}/resources",
  { params: { path: { workspaceId: workspace.id } } },
);
```

Path, params, body, and response are all typed from `app/api/openapi.ts`, which is generated from `apps/api/openapi/openapi.json`.

**When the REST API spec changes**, regenerate the types:

```bash
pnpm -F @ctrlplane/web generate
```

This runs `openapi-typescript` against the API's `openapi.json`. Commit the regenerated `app/api/openapi.ts`.

### Build a form

Use `react-hook-form` + `zod` + the shadcn `Form` component for any form with more than a couple of fields:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
});

export function CreateFooForm({ onSubmit }: { onSubmit: (values: z.infer<typeof schema>) => void }) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>Create</Button>
      </form>
    </Form>
  );
}
```

Validation lives in the zod schema; the UI rendering lives in `FormField`. Don't manually manage `useState` for form fields.

### Store state in the URL

For state that should survive a refresh or be shareable via URL (filters, selected tab, pagination), use the URL as the source of truth.

**Simple string params** — React Router's `useSearchParams`:

```tsx
import { useSearchParams } from "react-router";

const [searchParams, setSearchParams] = useSearchParams();
const filter = searchParams.get("filter") ?? "all";
```

**Typed params** — [nuqs](https://nuqs.47ng.com/) (already wired up in `root.tsx`):

```tsx
import { useQueryState, parseAsStringEnum } from "nuqs";

const [status, setStatus] = useQueryState(
  "status",
  parseAsStringEnum(["all", "active", "archived"]).withDefault("all"),
);
```

Use nuqs when you want parsed/typed values or defaults; use `useSearchParams` for quick string flags.

### Access the current workspace

Anything inside `/:workspaceSlug/...` is wrapped by `WorkspaceProvider` (set up in `protected.tsx`). Read it with:

```tsx
import { useWorkspace } from "~/components/WorkspaceProvider";

const { workspace } = useWorkspace();
// workspace: { id, name, slug }
```

This throws if called outside the provider — which is the desired behavior. Don't render workspace-scoped components outside the `ws/` route tree.

### Add a shadcn UI component

shadcn components are **copied into the repo** (not installed as a dependency). To add one:

```bash
pnpm ui-add <component-name>
# e.g. pnpm ui-add toggle-group
```

This writes the component to `app/components/ui/`. Tweak it freely — it's your code now. Don't edit generated shadcn primitives to contain feature logic, though; compose them in feature-level components instead.

Existing primitives to check before adding new ones: button, input, select, dialog, sheet, dropdown-menu, command, form, table, tabs, popover, tooltip, toast (`sonner`), and the others listed in `components/ui/`.

## Styling

- **Tailwind v4**. Use utility classes. Use `cn()` from `~/lib/utils` to compose conditional classes.
- **Dark mode**: `ThemeProvider` defaults to dark. Pages should style both themes — use `bg-background`, `text-foreground`, etc. (Tailwind CSS variables), not hardcoded `bg-white` / `text-black`.
- **Spacing/sizing**: prefer Tailwind scale (`p-4`, `gap-2`, `h-8`) over arbitrary values.
- **No CSS-in-JS**. No stylesheets per component. If you need something Tailwind can't express, add it to `app.css`.

## Common Pitfalls

- **Forgetting to add the route to `routes.ts`.** Dropping a file in `app/routes/` does nothing on its own — the route tree is explicit. If your page 404s, check `routes.ts` first.
- **Stale REST types after an API change.** If you edited `apps/api/openapi/` and your `openapi-fetch` calls are red-squiggled, run `pnpm -F @ctrlplane/web generate`. tRPC types propagate automatically; REST types need regeneration.
- **Calling `useWorkspace()` outside the `ws/` tree.** The provider isn't mounted on `/login`, `/sign-up`, or `/workspaces/create` — calling the hook there throws. Gate component rendering on route.
- **Writing feature logic inside `components/ui/*.tsx`.** Those are shadcn primitives; keep them generic. Feature logic belongs in route files or feature-level components (e.g. `routes/ws/deployments/_components/…`).
- **Assuming SSR.** Don't use `typeof window === "undefined"` guards; we're client-only. Don't fetch data in a loader/action — use tRPC/openapi-fetch from inside components.
- **Not wrapping async mutations with toast feedback.** Use `sonner` (already wired in `root.tsx`) to give users feedback on mutations: `toast.success("Deployment created")` / `toast.error(...)`. Silent mutations feel broken.
- **Over-using React state for URL-worthy data.** Filters, tab selections, and open-panel state should live in the URL (nuqs or searchParams), not `useState`. Refreshing the page shouldn't reset the user's context.
- **Editing `app/api/openapi.ts` by hand.** It's generated; your edits will vanish on the next `generate`.
