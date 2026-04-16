# Contributing to `apps/api`

This is the service guide for `apps/api` — the Node/Express service that handles REST, tRPC, webhooks, and auth. It assumes you've completed the root [CONTRIBUTING.md](../../CONTRIBUTING.md) setup and can run `pnpm dev`.

## Table of Contents

- [What This Service Does](#what-this-service-does)
- [Architecture](#architecture)
- [Directory Layout](#directory-layout)
- [Recipes](#recipes)
  - [Add a REST endpoint](#add-a-rest-endpoint)
  - [Add a webhook handler](#add-a-webhook-handler)
  - [Require authentication and check access](#require-authentication-and-check-access)
  - [Enqueue reconciliation work](#enqueue-reconciliation-work)
  - [Return a typed error](#return-a-typed-error)
- [Testing](#testing)
- [Common Pitfalls](#common-pitfalls)

## What This Service Does

`apps/api` is the entry point for everything that talks to Ctrlplane from the outside:

- **REST API** (`/api/v1/*`) — OpenAPI-specified, used by the CLI, Terraform provider, and external integrations
- **tRPC** (`/api/trpc/*`) — type-safe RPC used by the web app
- **Webhooks** (`/api/github`, `/api/tfe`, `/api/argo`) — inbound events from external systems
- **Auth** (`/api/auth/*`) — better-auth sign-in, sessions, OAuth callbacks

It owns the synchronous request/response surface. Long-running work (computing release targets, evaluating policies, dispatching jobs) is not done here — the API validates the request, writes the change to Postgres, and enqueues work for `workspace-engine` to pick up.

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                       apps/api (Express)                     │
│                                                              │
│   cors / helmet / body parsers / cookies / logger            │
│                            │                                 │
│                            ▼                                 │
│             ┌─────────────────────────┐                      │
│             │  OpenAPI validator      │  validates /api/v1   │
│             │  (skips auth/trpc/      │  requests against    │
│             │   webhooks/healthz)     │  openapi.json        │
│             └─────────────────────────┘                      │
│                            │                                 │
│     ┌──────────────────────┼───────────────────────┐         │
│     ▼                      ▼                       ▼         │
│  /api/auth/*        /api/v1/* (REST)       /api/trpc/*       │
│  better-auth      requireAuth + routers     tRPC middleware  │
│                                                              │
│  /api/github/*   /api/tfe/*   /api/argo/*   (webhooks)       │
│                            │                                 │
│                            ▼                                 │
│                   error-handler middleware                   │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
                      PostgreSQL (Drizzle)
                             │
                             ▼
          enqueue work into reconcile_work_scope
                             │
                             ▼
                      workspace-engine picks it up
```

**Key design decisions:**

- **REST surface is OpenAPI-first.** Paths and schemas live in `openapi/` as jsonnet, compile to `openapi.json`, and generate `src/types/openapi.ts`. `express-openapi-validator` enforces the spec at runtime; `AsyncTypedHandler<Path, Method>` enforces it at compile time.
- **tRPC lives in `@ctrlplane/trpc`,** not here. This app only mounts the tRPC Express adapter. Adding a tRPC procedure means editing `packages/trpc`, not `apps/api`.
- **Auth is unified but dual-mode.** `requireAuth` middleware accepts either `X-API-Key` or a session cookie and populates `req.apiContext` with `{ db, authMethod, session, user }`.
- **The API never performs reconciliation.** It writes domain state and enqueues work. `workspace-engine` does the actual computation.

## Directory Layout

```text
apps/api/
├── openapi/              # OpenAPI spec (jsonnet source → openapi.json)
│   ├── main.jsonnet      # Entry point; imports paths/ and schemas/
│   ├── paths/            # One file per resource (workspaces, deployments, …)
│   ├── schemas/          # Shared request/response schemas
│   ├── lib/              # Jsonnet helpers
│   └── openapi.json      # Generated — do not edit by hand
└── src/
    ├── index.ts          # Entry point (listens on PORT)
    ├── server.ts         # Express app wiring: middleware, routers
    ├── auth.ts           # Session helpers (getSession)
    ├── config.ts         # Env var parsing (@t3-oss/env-core + zod)
    ├── client.ts         # openapi-fetch client export (for other packages)
    ├── middleware/
    │   ├── auth.ts       # requireAuth, optionalAuth
    │   └── error-handler.ts
    ├── routes/
    │   ├── index.ts      # Mounts /v1 sub-routers
    │   ├── v1/           # REST (OpenAPI-validated)
    │   │   └── workspaces/   # All workspace-scoped resources nest here
    │   ├── github/       # GitHub webhook handlers
    │   ├── tfe/          # Terraform Cloud webhook handlers
    │   └── argoworkflow/ # Argo Workflow webhook handlers
    └── types/
        ├── api.ts        # AsyncTypedHandler, ApiContext, error classes
        └── openapi.ts    # Generated from openapi.json — do not edit
```

## Recipes

### Add a REST endpoint

REST endpoints are OpenAPI-first. The spec is the source of truth: if the handler's types don't match the spec, the build fails.

**1. Describe the endpoint in jsonnet.** Find the right file in `openapi/paths/` (or create a new one and import it from `main.jsonnet`). For example, to add `POST /v1/workspaces/{workspaceId}/foos`:

```jsonnet
// openapi/paths/foos.jsonnet
{
  '/v1/workspaces/{workspaceId}/foos': {
    post: {
      summary: 'Create a foo',
      operationId: 'createFoo',
      tags: ['Foos'],
      parameters: [
        { name: 'workspaceId', 'in': 'path', required: true,
          schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/CreateFooRequest' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created',
          content: { 'application/json': {
            schema: { '$ref': '#/components/schemas/Foo' },
          } },
        },
        '401': { '$ref': '#/components/responses/Unauthorized' },
        '404': { '$ref': '#/components/responses/NotFound' },
      },
    },
  },
}
```

Add the schemas it references in `openapi/schemas/`.

**2. Regenerate the OpenAPI artifacts.**

```bash
pnpm -F @ctrlplane/web-api generate
```

This runs `jsonnet openapi/main.jsonnet > openapi/openapi.json` and regenerates `src/types/openapi.ts` via `openapi-typescript`. Commit both.

**3. Write the handler.** Handlers live next to their router, typed against the OpenAPI path + method:

```ts
// src/routes/v1/workspaces/foos.ts
import type { AsyncTypedHandler } from "@/types/api.js";
import { NotFoundError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

const createFoo: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/foos",
  "post"
> = async (req, res) => {
  const { db, user } = req.apiContext!;
  const { workspaceId } = req.params;
  const { name } = req.body;

  const foo = await db
    .insert(schema.foo)
    .values({ workspaceId, name, createdBy: user.id })
    .returning()
    .then(takeFirst);

  res.status(201).json(foo);
};

export const foosRouter = Router().post("/", asyncHandler(createFoo));
```

Notes:

- `req.apiContext!` — the non-null assertion is safe because `requireAuth` runs before `/v1` routers. The middleware guarantees it's populated.
- `req.body`, `req.params`, `req.query` are all strongly typed from the OpenAPI spec.
- `asyncHandler` wraps the handler so thrown errors reach the error middleware.

**4. Mount the router.** In `src/routes/v1/workspaces/index.ts`:

```ts
import { foosRouter } from "./foos.js";

// inside createWorkspacesRouter()
.use("/:workspaceId/foos", foosRouter)
```

**5. Write an e2e test.** See [Testing](#testing) below.

### Add a webhook handler

Webhooks skip the OpenAPI validator (see the `ignorePaths` regex in `server.ts`) because external systems control the payload shape. Each provider has its own router.

```ts
// src/routes/github/webhooks/my-event.ts
import { Router } from "express";
import { asyncHandler } from "@/types/api.js";

export const myEventRouter = Router().post("/", asyncHandler(async (req, res) => {
  // 1. Verify the signature (provider-specific)
  // 2. Parse and validate the payload with zod
  // 3. Write domain state and enqueue reconciliation work
  // 4. Return 200 quickly — providers retry on slow responses
  res.status(200).send();
}));
```

Signature verification is **mandatory** for public webhooks. GitHub uses `X-Hub-Signature-256`; look at existing handlers in `src/routes/github/` for the pattern.

### Require authentication and check access

Any route mounted under `/api/v1` is already authenticated — `requireAuth` populates `req.apiContext`.

For **workspace access control**, check the user's role on the workspace. The pattern used throughout existing handlers:

```ts
const { db, user } = req.apiContext!;
const isAdmin = user.systemRole === "admin";

const hasAccess = isAdmin
  ? true
  : await db
      .select()
      .from(entityRole)
      .where(and(
        eq(entityRole.scopeId, workspaceId),
        eq(entityRole.scopeType, "workspace"),
        eq(entityRole.entityId, user.id),
        eq(entityRole.entityType, "user"),
      ))
      .limit(1)
      .then((rows) => rows.length > 0);

if (!hasAccess) throw new NotFoundError("Workspace not found");
```

Return `404 Not Found` rather than `403 Forbidden` for workspaces the user can't see — it avoids leaking existence.

### Enqueue reconciliation work

When a write changes something that affects releases (a new version, a changed resource, a policy update), enqueue work for `workspace-engine` using the helpers in `@ctrlplane/db/reconcilers`:

```ts
import {
  enqueueManyDeploymentSelectorEval,
  enqueueManyEnvironmentSelectorEval,
  enqueueReleaseTargetsForResource,
} from "@ctrlplane/db/reconcilers";

// After upserting a resource:
await enqueueReleaseTargetsForResource(db, { workspaceId, resourceId });

// After changing a deployment selector:
await enqueueManyDeploymentSelectorEval(db, { deploymentIds });
```

These write into `reconcile_work_scope`. `workspace-engine` leases and processes them asynchronously — your endpoint should not wait for the result.

**Rule of thumb**: if the response semantics require the reconciliation to have completed, you're probably doing it wrong. Return `202 Accepted` and let the engine do its job.

### Return a typed error

Throw one of the error classes in `src/types/api.ts`; the error middleware converts them to HTTP responses:

```ts
import { NotFoundError, BadRequestError, ForbiddenError, ApiError } from "@/types/api.js";

throw new NotFoundError("Foo not found");
throw new BadRequestError("Invalid selector", { selector });
throw new ApiError("Conflict", 409, "DUPLICATE_SLUG");
```

Do **not** call `res.status(…).json(…)` for error cases in new handlers — throwing is the convention, and it keeps the response shape consistent.

## Testing

API tests live in `e2e/tests/api/` and use Playwright with an `openapi-fetch` client. There are no unit tests in `apps/api` — the e2e tests exercise the real Express app against a real database, which is what we care about.

### Writing a test

Import `test` from the fixtures file, which gives you an authenticated `api` client and a pre-seeded `workspace`:

```ts
// e2e/tests/api/foos.spec.ts
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Foos API", () => {
  test("creates and retrieves a foo", async ({ api, workspace }) => {
    const name = `foo-${faker.string.alphanumeric(6)}`;

    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/foos",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );
    expect(createRes.response.status).toBe(201);
    expect(createRes.data!.name).toBe(name);

    // Clean up
    await api.DELETE(
      "/v1/workspaces/{workspaceId}/foos/{fooId}",
      { params: { path: { workspaceId: workspace.id, fooId: createRes.data!.id } } },
    );
  });
});
```

`api` is typed from the OpenAPI spec — path, params, body, and response are all inferred. If the spec and handler disagree, either the test or the build fails.

### When to use YAML fixtures

For tests that need a system + environments + resources + deployments + policies in a coherent configuration, use the YAML fixture loader instead of building entities by hand. See [e2e/README.md](../../e2e/README.md) for the full pattern and available template helpers.

Pass `addRandomPrefix: true` when the same fixture is imported by tests that may run in parallel.

### Running the tests

```bash
cd e2e
pnpm exec playwright test tests/api/foos.spec.ts   # one file
pnpm test:api                                       # all API tests
pnpm test:debug                                     # step through with the inspector
```

The e2e suite expects `pnpm dev` to be running (or a seeded workspace state at `.state/workspace.json`). See `e2e/README.md` for details.

## Common Pitfalls

- **Forgetting to regenerate `openapi.json`.** If you edited jsonnet but didn't run `pnpm -F @ctrlplane/web-api generate`, the validator will reject your request at runtime even though your handler's types look right. Always regenerate and commit both the jsonnet and the generated JSON/TS.
- **Skipping the OpenAPI spec for a new endpoint.** `express-openapi-validator` will 404 any path that isn't in the spec. Adding the handler without adding the spec leaves you with dead code.
- **Writing `res.status(400).json(…)` instead of throwing.** Inconsistent error shapes leak through. Throw one of the error classes and let the error middleware format the response.
- **Not scoping queries by `workspaceId`.** Nearly every table has a `workspaceId` column. Forgetting it is a cross-tenant data leak — treat it as a hard invariant.
- **Blocking on reconciliation.** If you find yourself polling for a release target to be computed before returning, you're fighting the architecture. Enqueue the work and return `202 Accepted`.
- **Testing behavior that depends on `workspace-engine`.** If an endpoint enqueues work, the test can only assert that the queue row was written, not that reconciliation has completed. For end-to-end behavior, write a Playwright test that waits for the observable outcome.
- **tRPC changes in the wrong repo.** tRPC routers live in `packages/trpc`, not here. If you need to add a procedure, that's where the change goes; `apps/api` just mounts the router.
