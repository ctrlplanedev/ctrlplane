# AGENTS.md

This is the canonical agent guidance for this repository. Legacy `CLAUDE.md`
files may still exist, but prefer this file for Codex and other coding agents.

## Product context

Ctrlplane is the orchestration layer between CI/CD pipelines and infrastructure.
It decides when releases are ready, where they should deploy, and which gates
must pass first, including environment promotion, verification, approvals, and
rollbacks.

```text
CI/CD -> Ctrlplane orchestrates -> Infrastructure
```

## Repository overview

- Monorepo managed by Turborepo and pnpm.
- Package names generally use the `@ctrlplane/` scope.
- Primary roots: `apps/`, `packages/`, `integrations/`, `docs/`, `e2e/`,
  `tooling/`.
- `apps/web/`: React 19 and React Router frontend.
- `apps/api/`: TypeScript API, tRPC endpoint, REST/webhook handlers, jsonnet.
- `apps/workspace-engine/`: Go reconciliation engine. See its scoped
  `AGENTS.md` before editing inside that directory.
- `apps/relay/`: Go WebSocket relay for job agent communication.
- `apps/workspace-engine-router/`: Go service for workspace-engine routing.
- `packages/db/`: Drizzle ORM schema, PostgreSQL migrations, database package.
- `packages/trpc/`: tRPC server setup.
- `packages/auth/`: better-auth integration.
- `packages/workspace-engine-sdk/`: TypeScript SDK for external integrations.
- `integrations/`: external service adapters.
- `e2e/`: Playwright end-to-end tests for API and UI flows.
- `tooling/`: shared ESLint, Prettier, TypeScript, OpenAPI, and Tailwind config.

## Setup

- Use `pnpm` for Node/TypeScript work.
- Install dependencies with `pnpm install`.
- Start local services with `docker compose -f docker-compose.dev.yaml up -d`.
- Apply database migrations with `pnpm -F @ctrlplane/db migrate`.
- Start dev servers with `pnpm dev`.
- First-time setup commonly uses:

```bash
docker compose -f docker-compose.dev.yaml up -d
pnpm install
pnpm build
pnpm -F @ctrlplane/db migrate
pnpm dev
```

- To reset local Docker state, wipe volumes first, then remigrate:

```bash
docker compose -f docker-compose.dev.yaml down -v
docker compose -f docker-compose.dev.yaml up -d
pnpm -F @ctrlplane/db migrate
pnpm dev
```

## Common commands

- `pnpm build`: build all packages.
- `pnpm lint`: run ESLint.
- `pnpm lint:fix`: run ESLint with auto-fix.
- `pnpm format`: check formatting.
- `pnpm format:fix`: fix formatting.
- `pnpm typecheck`: type check all packages.
- `pnpm test`: run all tests.
- `pnpm -F <package-name> test`: run tests for a specific package.
- `pnpm -F <package-name> test -- -t "test name"`: run a specific test.

## Database commands

- `pnpm -F @ctrlplane/db migrate`: run migrations.
- `pnpm -F @ctrlplane/db push`: apply schema changes in dev without creating a
  migration file.
- `pnpm -F @ctrlplane/db studio`: open Drizzle Studio.

## E2E tests

- Run all E2E tests from `e2e/` with `pnpm exec playwright test`.
- Run a specific E2E file with
  `pnpm exec playwright test tests/api/resources.spec.ts`.
- Run API E2E tests with `pnpm test:api`.
- Run in debug mode with `pnpm test:debug`.
- E2E tests use YAML fixture files (`.spec.yaml` beside `.spec.ts`) to declare
  entities.
- Use `importEntitiesFromYaml` to load fixtures and `cleanupImportedEntities`
  to tear them down.
- Use `addRandomPrefix: true` when parallel runs could conflict.

## Service architecture

- Web -> API: tRPC over `/api/trpc`.
- API -> workspace-engine: PostgreSQL work queue using `reconcile_work_scope`.
- Relay -> job agents: bidirectional WebSocket streaming.
- External webhooks from GitHub, ArgoCD, Terraform Cloud, and related systems
  enter through `apps/api`.

## Release and deployment flow

```text
CI registers version
-> Release target planning across resources and environments
-> Policy evaluation for approvals, environment ordering, windows, rollout
-> Job dispatch to GitHub Actions, ArgoCD, Terraform Cloud, or custom agents
-> Verification using metrics checks
-> Promotion, retry, or rollback
```

## Reconciliation model

- The workspace-engine uses a PostgreSQL-backed queue.
- Controllers poll `reconcile_work_scope` for leased work items.
- Lease-based locking prevents duplicate processing and allows crashed workers
  to be recovered by another worker after lease expiration.
- Controllers can use `Result.RequeueAfter` for scheduled retries and polling.
- The engine is horizontally scalable.
- The `SERVICES` environment variable can activate a subset of controllers per
  instance.

Core controllers include:

- `deploymentplan`: compute resources that match a deployment selector and fan
  out planning work.
- `deploymentplanresult`: materialize final release rows from plan results.
- `desiredrelease`: determine the target release per resource/environment.
- `policyeval`: evaluate policy rules against release targets.
- `jobdispatch`: route jobs to the correct job agent.
- `jobeligibility`: check whether a job can run.
- `jobverificationmetric`: poll verification metrics.
- `environmentresourceselectoreval`: evaluate environment-level resource
  selectors.
- `deploymentresourceselectoreval`: evaluate deployment-level resource
  selectors.
- `relationshipeval`: evaluate resource relationship rules.
- `forcedeploy`: handle manual force-deploy requests.

## Policy engine

- Policies are CEL-based declarative rules.
- A policy `selector` is a CEL expression that matches resources and
  environments.
- All applicable policies for a release target must pass.
- Rule types include approvals, environment progression, deployment windows,
  gradual rollout, verification, retry, and rollback.
- Treat policy behavior as core product semantics. Prefer explicit tests for
  edge cases and rule interactions.

## Database model

Drizzle manages the PostgreSQL schema in `packages/db`. Key concepts include:

- `workspace`: tenant isolation. Workspace-scoped tables include `workspaceId`.
- `deployment` and `deploymentVersion`: service definitions and builds.
- `environment`: deployment targets such as staging and production.
- `resource` and `resourceProvider`: infrastructure inventory.
- `release`, `releaseTarget`, and `releaseJob`: deployment instances and units
  of execution.
- `job` and `jobAgent`: work units and executor configuration.
- `policy` and `policyRule*`: CEL-based deployment gates.
- `reconcile_work_scope`: work queue with kind, scope type, scope id, priority,
  and not-before scheduling.

## Job agents

- Job agents are execution adapters stored in the `jobAgent` table.
- Supported agents include GitHub Actions, ArgoCD, Kubernetes Jobs, Terraform
  Cloud, Argo Workflows, and custom agents.
- The `jobdispatch` controller routes jobs to agents.
- Agents translate Ctrlplane job specs to agent-native formats and correlate
  results through `externalId` or equivalent provider identifiers.

## Code style

- Keep changes focused and minimal.
- Avoid editing generated files unless the task requires it.
- TypeScript: use explicit types and prefer interfaces for public APIs.
- Imports: use named imports and group by source: standard, external, internal.
- Type imports: use `import type { Type } from "module"`.
- Prefer `async`/`await` over raw promise chains.
- React: use functional components only. Prefer explicit `React.FC<Props>`
  typing, for example `const MyComponent: React.FC<Props> = () => {}`.
- Format TypeScript with Prettier through `@ctrlplane/prettier-config`.
- Go: keep code `gofmt`-compliant and follow existing package patterns.
- Promote the builder pattern for complex object construction and
  configuration.
- Do not add obvious comments. Comments should explain why something is done,
  complex business logic, or non-obvious tradeoffs.

## Testing guidance

- For TypeScript packages, use the existing vitest setup.
- For Go services, run `go test` inside the relevant module.
- Keep tests close to the code that changed when practical.
- For controller or policy changes, add focused tests for the specific behavior
  and relevant edge cases.
- When feasible, run formatting, linting, and typechecking for the package you
  changed before finishing.
- If a command is too expensive or unavailable, state that clearly in the final
  response.

## Agent workflow

- Build context from the codebase before editing.
- Prefer `rg` for search and `rg --files` for file discovery.
- Do not revert unrelated user changes.
- Do not use destructive git commands unless the user explicitly asks.
- If adding dependencies, use the package manager and current compatible
  versions.
- For code review requests, prioritize bugs, regressions, missing tests, and
  risks before summaries.
- For large or risky changes, prefer targeted edits and targeted verification
  over broad rewrites.
