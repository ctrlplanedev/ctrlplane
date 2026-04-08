# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is Ctrlplane?

Ctrlplane is the **orchestration layer between CI/CD pipelines and infrastructure** — it decides when releases are ready, where they should deploy, and what gates they must pass (environment promotion, verification, approvals, rollbacks).

```text
Your CI/CD  →  Ctrlplane (orchestrates)  →  Your Infrastructure
```

## Common Commands

### Setup (first time)
```bash
docker compose -f docker-compose.dev.yaml up -d   # Start local services
pnpm i && pnpm build                              # Install deps and build
pnpm -F @ctrlplane/db migrate                     # Apply database migrations
pnpm dev                                          # Start all dev servers
# Reset (wipe all Docker volumes first):
docker compose -f docker-compose.dev.yaml down -v
docker compose -f docker-compose.dev.yaml up -d
pnpm -F @ctrlplane/db migrate
pnpm dev
```

### Day-to-day
- `pnpm test` — Run all TypeScript tests
- `pnpm lint` — Lint all TypeScript code
- `pnpm format:fix` — Format all TypeScript code
- `pnpm build` — Build all packages
- `pnpm typecheck` — TypeScript type check across all packages
- `pnpm -F <package-name> test` — Run tests for a specific package
- `pnpm -F <package-name> test -- -t "test name"` — Run a specific test

### Database
- `pnpm -F @ctrlplane/db migrate` — Run migrations
- `pnpm -F @ctrlplane/db push` — Apply schema changes (dev, no migration file)
- `pnpm -F @ctrlplane/db studio` — Open Drizzle Studio UI

### E2E Tests (Playwright)
```bash
cd e2e
pnpm exec playwright test                          # Run all e2e tests
pnpm exec playwright test tests/api/resources.spec.ts  # Run a specific file
pnpm test:api                                      # Run all API tests
pnpm test:debug                                    # Run in debug mode
```
E2E tests use YAML fixture files (`.spec.yaml` alongside `.spec.ts`) to declare test entities. `importEntitiesFromYaml` loads them; `cleanupImportedEntities` tears them down. Use `addRandomPrefix: true` when parallel runs may conflict.

### workspace-engine (Go)
```bash
cd apps/workspace-engine
go run ./...                                 # Run without building
go build -o ./bin/workspace-engine .         # Build binary
go test ./...                                # Run tests
golangci-lint run                            # Lint
go fmt ./...                                 # Format
```

## Monorepo Structure

```text
apps/
  api/              # Node.js/Express REST API — core business logic
  web/              # React 19 + React Router frontend
  workspace-engine/ # Go reconciliation engine (multiple controllers)
  relay/            # Go WebSocket relay for agent communication
packages/
  db/               # Drizzle ORM schema + migrations (PostgreSQL)
  trpc/             # tRPC server setup
  auth/             # better-auth integration
  workspace-engine-sdk/ # Published TypeScript SDK for external integrations
integrations/       # External service adapters
e2e/                # Playwright end-to-end tests (API + UI)
tooling/            # Shared ESLint, Prettier, TypeScript configs
```

**Build system**: Turborepo + pnpm workspaces. Package names use `@ctrlplane/` scope.

## Architecture

### Service Communication

- **Web → API**: tRPC (type-safe RPC via `/api/trpc`)
- **API → workspace-engine**: PostgreSQL work queue (`reconcile_work_scope` table)
- **Relay → Job Agents**: WebSocket bidirectional streaming
- **External webhooks** (GitHub, ArgoCD, Terraform Cloud) hit `apps/api`

### Reconciliation / Work Queue

The workspace-engine implements a PostgreSQL-backed work queue. Multiple controllers poll `reconcile_work_scope` for leased work items:

| Controller | Responsibility |
|---|---|
| `deploymentplan` | Compute which resources match a deployment selector |
| `desiredrelease` | Determine target release per resource |
| `policyeval` | Evaluate policy rules against release targets |
| `jobdispatch` | Route jobs to the correct job agent |
| `jobeligibility` | Check whether a job can run |
| `jobverificationmetric` | Poll verification metrics (Datadog, Prometheus, HTTP) |
| `environmentresourceselectoreval` | Evaluate env-level resource selectors |
| `relationshipeval` | Evaluate resource relationship rules |

Controllers use lease-based locking to prevent duplicate processing and support `Result.RequeueAfter` for scheduled retries. The engine is horizontally scalable — use `SERVICES` env var to activate specific controllers per instance.

### Release & Deployment Flow

```text
CI registers version
  → Release Target Planning (resource × environment fan-out)
  → Policy Evaluation (approvals, environment ordering, deploy windows)
  → Job Dispatch (GitHub Actions / ArgoCD / Terraform Cloud / custom agent)
  → Verification (metrics checks → promote or rollback)
```

### Policy Engine

Policies are **CEL-based declarative rules** with a `selector` field (CEL expression) matching resources/environments. Rule types:

- `policyRuleAnyApproval` — require N approvals
- `policyRuleEnvironmentProgression` — enforce environment ordering (staging → prod)
- `policyRuleDeploymentWindow` — restrict deploy times (rrule-based schedules)
- `policyRuleGradualRollout` — sequential fan-out with intervals
- `policyRuleVerification` — check metrics before advancing
- `policyRuleRetry` / `policyRuleRollback` — failure handling

All policies for a release target must pass (AND between types, OR within a type).

### Database Schema (packages/db)

Drizzle ORM manages the PostgreSQL schema. Key tables:

- `workspace` — multi-tenant isolation; all tables include `workspaceId`
- `deployment` / `deploymentVersion` — service definitions and builds
- `environment` — staging, prod, etc.
- `resource` / `resourceProvider` — infrastructure inventory
- `release` / `releaseJob` — deployment instances and execution units
- `job` / `jobAgent` — execution units and executor configs
- `policy` / `policyRule*` — CEL-based deployment gates
- `reconcile_work_scope` — work queue (kind, scopeType, scopeId, priority, notBefore)

### Job Agents

Job agents are execution adapters stored in the `jobAgent` table. Supported agents: GitHub Actions, ArgoCD, Kubernetes Jobs, Terraform Cloud, Argo Workflows. The `jobdispatch` controller routes jobs to agents; each translates a job spec to agent-native format and correlates results via `externalId`.

## Code Style

- TypeScript with explicit types; prefer `interface` for public APIs
- Named imports; group by source (std lib → external → internal)
- `import type { Type }` for type-only imports
- Prettier via `@ctrlplane/prettier-config`
- `async/await` over raw promises
- React: functional components only; type as `const Foo: React.FC<Props> = () => {}`
- Tests use vitest with typed fixtures
- Use the builder pattern for complex object construction
- For Go (workspace-engine): see `apps/workspace-engine/CLAUDE.md` for its own guidelines
