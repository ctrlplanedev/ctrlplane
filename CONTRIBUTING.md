# Contributing to Ctrlplane

Thanks for your interest in contributing! This guide covers everything you need to get a local dev environment running, find your way around the repo, and open a pull request we can review quickly.

If you're planning a larger change, please **open an issue or GitHub Discussion first** so we can align on the approach before you invest time in it.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Help](#getting-help)
- [Reporting Bugs and Requesting Features](#reporting-bugs-and-requesting-features)
- [Development Setup](#development-setup)
- [Repository Structure](#repository-structure)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Service-Specific Guides](#service-specific-guides)
- [Code Style and Conventions](#code-style-and-conventions)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Opening a Pull Request](#opening-a-pull-request)

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold it. Report unacceptable behavior to `conduct@ctrlplane.dev`.

## Getting Help

- **Questions about using Ctrlplane** → [GitHub Discussions](https://github.com/ctrlplanedev/ctrlplane/discussions) or [Discord](https://ctrlplane.dev/discord)
- **Contributor questions** → `#contributors` on Discord, or comment on an issue
- **Security vulnerabilities** → email `security@ctrlplane.dev`; please do not open a public issue. See [SECURITY.md](SECURITY.md) for details.

## Reporting Bugs and Requesting Features

- **Bugs**: open a [bug report](https://github.com/ctrlplanedev/ctrlplane/issues/new?template=bug_report.yml) with reproduction steps, expected vs. actual behavior, and your environment (OS, Node version, Go version if relevant).
- **Features / enhancements**: open a [feature request](https://github.com/ctrlplanedev/ctrlplane/issues/new?template=feature_request.yml) describing the problem you're solving, not just the solution you have in mind.
- Browse [`good first issue`](https://github.com/ctrlplanedev/ctrlplane/labels/good%20first%20issue) for beginner-friendly work and [`help wanted`](https://github.com/ctrlplanedev/ctrlplane/labels/help%20wanted) for where we'd appreciate outside help.

## Development Setup

### Prerequisites

| Tool    | Version      | Notes                                              |
| ------- | ------------ | -------------------------------------------------- |
| Node.js | `>= 22.10.0` | Managed by Flox, or install directly               |
| pnpm    | `^10.2.0`    | Managed by Flox, or install directly               |
| Go      | `1.26+`      | Only needed for `workspace-engine`                 |
| Docker  | latest       | For Postgres, Kafka, and local observability stack |

**Recommended path**: install [Flox](https://flox.dev/docs/install-flox/install/) and run `flox activate` in the repo — it provisions Node, pnpm, Go, and the rest of the toolchain at the versions this repo expects.

**Manual path**: install Node, pnpm, Go, and Docker yourself. Any compatible versions work.

### First-Time Setup

```bash
git clone https://github.com/ctrlplanedev/ctrlplane.git
cd ctrlplane

# (Recommended) activate the tooling environment
flox activate

# Create your local env file from the example
cp .env.example .env

# Start local services (Postgres, Kafka, Jaeger, Prometheus, OTel collector)
docker compose -f docker-compose.dev.yaml up -d

# Install dependencies and build all packages
pnpm i && pnpm build

# Apply database migrations
pnpm -F @ctrlplane/db migrate

# Start all dev servers
pnpm dev
```

Once everything is running:

- **Web app**: http://localhost:5173
- **API**: http://localhost:3000 (tRPC + REST)
- **workspace-engine**: http://localhost:8081
- **Jaeger (traces)**: http://localhost:16686
- **Prometheus (metrics)**: http://localhost:9999
- **Drizzle Studio (DB UI)**: `pnpm -F @ctrlplane/db studio`

**Logging in locally**: with no OAuth providers configured, the app falls back to email + password auth. Visit the web app, sign up with any email/password, and you're in. To test OAuth flows, set `AUTH_GOOGLE_CLIENT_ID` / `AUTH_OKTA_*` / `AUTH_OIDC_*` in `.env`.

### Resetting Your Environment

When you need a clean slate — corrupted DB, schema conflicts, stale Kafka state:

```bash
docker compose -f docker-compose.dev.yaml down -v   # wipes all volumes
docker compose -f docker-compose.dev.yaml up -d
pnpm -F @ctrlplane/db migrate
pnpm dev
```

### Day-to-Day Commands

| Command                           | Description                               |
| --------------------------------- | ----------------------------------------- |
| `pnpm dev`                        | Start all dev servers (hot reload)        |
| `pnpm build`                      | Build all packages                        |
| `pnpm test`                       | Run all TypeScript tests                  |
| `pnpm lint`                       | Lint all TypeScript code                  |
| `pnpm lint:fix`                   | Auto-fix lint errors                      |
| `pnpm format:fix`                 | Auto-format all TypeScript code           |
| `pnpm typecheck`                  | TypeScript type check across all packages |
| `pnpm -F <pkg> test`              | Run tests for a specific package          |
| `pnpm -F <pkg> test -- -t "name"` | Run a specific test by name               |

**Database:**

```bash
pnpm -F @ctrlplane/db migrate   # Apply pending migrations
pnpm -F @ctrlplane/db push      # Push schema changes without a migration file (dev only)
pnpm -F @ctrlplane/db studio    # Open Drizzle Studio UI
```

**workspace-engine (Go):**

```bash
cd apps/workspace-engine
go run .                             # Run the service binary (without building)
go test ./...                        # Run tests
golangci-lint run                    # Lint
go fmt ./...                         # Format
```

By default `workspace-engine` runs all controllers. To run a subset (useful when debugging one), set `SERVICES` in `.env`:

```bash
SERVICES=deployment-plan,policy-eval
```

## Repository Structure

```text
apps/
  api/                 # Node/Express REST + tRPC API — core business logic
  web/                 # React 19 + React Router frontend
  workspace-engine/    # Go reconciliation engine (controllers)
packages/
  db/                  # Drizzle ORM schema + migrations (PostgreSQL)
  trpc/                # tRPC server setup
  auth/                # better-auth integration
  workspace-engine-sdk/ # Published TypeScript SDK for external integrations
integrations/          # External service adapters (GitHub, ArgoCD, Terraform Cloud, …)
e2e/                   # Playwright end-to-end tests (API + UI)
tooling/               # Shared ESLint, Prettier, TypeScript configs
```

**Build system**: [Turborepo](https://turbo.build/) + [pnpm workspaces](https://pnpm.io/workspaces). Internal packages use the `@ctrlplane/` scope.

## Architecture at a Glance

```text
                         ┌─────────────────┐
  Your CI (e.g. GHA) ──► │                 │
                         │                 │         ┌──────────────┐
  Webhooks     ────────► │   apps/api      │ ◄─tRPC──┤  apps/web    │
  (GitHub, Argo, TFC)    │                 │         └──────────────┘
                         │                 │
                         └────────┬────────┘
                                  │  enqueue work
                                  ▼
                         ┌─────────────────┐
                         │  PostgreSQL     │
                         │  reconcile_work │
                         └────────┬────────┘
                                  │  lease
                                  ▼
                         ┌─────────────────┐
                         │ workspace-engine│ ──► Job Agents (GHA, Argo, K8s, TFC)
                         │   controllers   │
                         └─────────────────┘
```

### How a release flows through the system

1. **CI registers a version** via the API (`POST /v1/versions`).
2. **`deploymentplan` controller** computes which resources match the deployment's selector — producing release targets (deployment × environment × resource).
3. **`desiredrelease` controller** picks the target version per release target.
4. **`policyeval` controller** evaluates gates: approvals, environment ordering, deploy windows, gradual rollout.
5. **`jobdispatch` controller** routes jobs to the correct job agent (ArgoCD, GitHub Actions, K8s Jobs, Terraform Cloud, custom).
6. **`jobverificationmetric` controller** polls metrics (Datadog, Prometheus, HTTP) — if verification passes, promote; if it fails, rollback.

### Work queue

All reconciliation happens through a PostgreSQL-backed work queue (`reconcile_work_scope` table). Controllers lease work, process it, and can return `RequeueAfter` to schedule retries. The engine is horizontally scalable — set `SERVICES` to activate specific controllers per instance.

### Policy engine

Policies are declarative CEL-based rules evaluated against release targets. Rule types include `policyRuleAnyApproval`, `policyRuleEnvironmentProgression`, `policyRuleDeploymentWindow`, `policyRuleGradualRollout`, `policyRuleVerification`, `policyRuleRetry`, `policyRuleRollback`. All rule types must pass (AND); within a type, any matching rule is sufficient (OR).

## Service-Specific Guides

Each service has its own contributing guide with architecture depth, common recipes ("how to add an X"), and testing patterns. Start with the root setup above, then dive into the service you're working on:

- [apps/api/CONTRIBUTING.md](apps/api/CONTRIBUTING.md) — Adding API endpoints, tRPC routers, webhooks
- [apps/web/CONTRIBUTING.md](apps/web/CONTRIBUTING.md) — React Router routes, components, tRPC hooks
- [apps/workspace-engine/CONTRIBUTING.md](apps/workspace-engine/CONTRIBUTING.md) — Adding controllers, work queue scopes, reconciliation patterns
- [packages/db/README.md](packages/db/README.md) — Schema changes, migrations, query patterns

> These guides are a work in progress — if a section you need doesn't exist, open an issue and we'll prioritize it.

## Code Style and Conventions

### TypeScript

- Explicit types on public APIs; prefer `interface` over `type` for object shapes
- `import type { … }` for type-only imports
- Named imports grouped by source: stdlib → external → internal (`@ctrlplane/*`)
- `async/await` over raw `.then()` chains
- Early returns over nested `if/else`
- Extract helpers instead of deeply nested logic
- Formatting via `@ctrlplane/prettier-config` — run `pnpm format:fix`

### React

- Functional components only, typed as `const Foo: React.FC<Props> = () => { … }`
- Co-locate components with their routes when feasible
- Prefer composition over prop drilling

### Go (workspace-engine, relay)

- Run `go fmt ./...` and `golangci-lint run` before committing
- Comments explain **why**, not **what** — skip comments that restate the code
- Table-driven tests for condition/rule logic
- Exported functions and types get doc comments

### General

- Don't add features, refactors, or abstractions beyond what the task requires
- Don't add error handling, fallbacks, or validation for cases that can't happen — trust internal contracts, only validate at boundaries
- Don't leave commented-out code, `TODO` comments without an issue link, or "removed X" notes

## Testing

Required for new code unless the change is purely docs/config.

| Kind              | Framework                             | Location                   | When to use                                                              |
| ----------------- | ------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| E2E / Integration | [Playwright](https://playwright.dev/) | `e2e/tests/**/*.spec.ts`   | API endpoints, webhooks, full-stack flows — the default for TS changes   |
| Go unit tests     | stdlib `testing`                      | `*_test.go` next to source | All `workspace-engine` logic                                             |

Most TypeScript changes are covered by **Playwright e2e tests** rather than per-package unit tests. Tests live in `e2e/tests/` and use YAML fixture files (`*.spec.yaml` alongside `*.spec.ts`) to declare test entities. Use `importEntitiesFromYaml` to load them and `cleanupImportedEntities` to tear them down. Pass `addRandomPrefix: true` when parallel runs might conflict.

```bash
cd e2e
pnpm exec playwright test                              # Run everything
pnpm exec playwright test tests/api/resources.spec.ts  # Run one file
pnpm test:api                                          # API-only suite
pnpm test:debug                                        # Debug mode
```

Before opening a PR:

```bash
pnpm test        # Runs unit tests where they exist (mainly Go)
pnpm lint
pnpm typecheck
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<optional scope>): <short summary>

<optional body explaining *why* — wrap at 72 chars>

<optional footer: Closes #123, BREAKING CHANGE: …>
```

**Common types**: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`, `build`.

**Examples:**

```
feat(api): add bulk version registration endpoint
fix(workspace-engine): prevent duplicate leases under concurrent polls
refactor(web): extract deployment selector into its own component
chore: bump better-auth to 1.4.6
```

Keep the summary line under ~70 characters. If the change is non-obvious, explain the motivation in the body — the diff shows _what_, the message should cover _why_.

## Opening a Pull Request

1. **Fork** the repo and create a branch from `main` (e.g. `feat/bulk-versions`, `fix/lease-race`).
2. **Make your changes**, including tests.
3. **Run the checks**: `pnpm test && pnpm lint && pnpm typecheck`.
4. **Push** and open a PR against `main`.
5. **Fill out the PR template**: what changed, why, how you tested, and any follow-ups.
6. **Link the issue** it closes (`Closes #123`) if applicable.
7. **Keep the PR focused** — one logical change per PR. Split large work into a sequence of small PRs rather than one mega-PR.

### What reviewers look for

- Tests that meaningfully cover the change
- No unrelated drive-by edits
- Clear commit history (squash fixups locally before pushing, or let us squash-merge)
- Docs and types updated alongside code changes
- No new lint/typecheck warnings

### After you open the PR

- CI runs lint, typecheck, tests, and e2e. Make sure it's green.
- A maintainer will review within a few business days. Ping on Discord if it's been longer.
- Respond to review feedback by pushing new commits to the same branch — don't force-push until the review is settled.
- Once approved, a maintainer will merge. Squash-merge is the default.

### By contributing

You confirm that:

- You have the right to submit the code under this repository's [LICENSE](LICENSE).
- Your contribution will be licensed under the same terms.

---

Thanks again for contributing — we appreciate every issue, PR, and discussion. 🎉
