<p align="center">
  <a href="https://ctrlplane.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://ctrlplane.dev/logo-white.png">
      <source media="(prefers-color-scheme: light)" srcset="https://ctrlplane.dev/logo-black.png">
      <img src="https://ctrlplane.dev/logo-black.png" alt="Ctrlplane" width="300">
    </picture>
  </a>
</p>

<p align="center">
  <a aria-label="Join the community on GitHub" href="https://github.com/ctrlplanedev/ctrlplane/discussions"><img alt="" src="https://img.shields.io/badge/Join_the_community-blueviolet?style=for-the-badge"></a>
  <a aria-label="Commit activity" href="https://github.com/ctrlplanedev/ctrlplane/activity"><img alt="" src="https://img.shields.io/github/commit-activity/m/ctrlplanedev/ctrlplane/main?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://ctrlplane.dev"><b>Website</b></a> •
  <a href="https://github.com/ctrlplanedev/ctrlplane/releases"><b>Releases</b></a> •
  <a href="https://docs.ctrlplane.dev"><b>Documentation</b></a>
</p>

---

## What is Ctrlplane?

**Ctrlplane is the orchestration layer between your CI/CD pipelines and your infrastructure.**

Your CI builds code. Your clusters run it. Ctrlplane decides _when_ releases are ready, _where_ they should deploy, and _what gates_ they must pass—handling environment promotion, verification, approvals, and rollbacks automatically.

```text
Your CI/CD    ──►    Ctrlplane    ──►    Your Infrastructure
 (builds)          (orchestrates)           (deploys)
```

## Why Ctrlplane?

| Problem                             | How Ctrlplane Helps                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| Manual environment promotion        | Auto-promote staging → prod when verification passes          |
| "Did the deploy actually work?"     | Automated verification via Datadog, Prometheus, HTTP checks   |
| Deploying to 50 clusters is painful | One deployment definition, Ctrlplane handles the fan-out      |
| No visibility into what's running   | Unified inventory: which version, which cluster, which region |
| Inconsistent deployment policies    | Centralized policy engine with flexible selectors             |

## :rocket: Key Features

- **Gradual Rollouts** — Deploy to targets sequentially with configurable intervals and verification between each
- **Policy Gates** — Require approvals, enforce environment sequencing, set deployment windows
- **Automated Verification** — Integrate with Datadog, Prometheus, or any HTTP endpoint
- **Auto-Rollback** — Automatically revert when verification fails
- **Infrastructure Inventory** — Unified view of resources across Kubernetes, cloud providers, and custom infra
- **Pluggable Execution** — Works with ArgoCD, Kubernetes Jobs, GitHub Actions, Terraform Cloud, or custom agents

## Who Is It For?

- **Platform teams** building internal developer platforms
- **DevOps/SRE** enforcing deployment policies at scale
- **Engineering orgs** with 10+ services across multiple environments
- **Multi-region deployments** needing coordinated rollouts

## :zap: Quick Start

See our [installation guide](https://docs.ctrlplane.dev/installation) to get started.

| Method     | Link                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker     | [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://docs.ctrlplane.dev/installation#docker-compose-development-%26-testing) |
| Kubernetes | [![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://docs.ctrlplane.dev/installation#kubernetes-production)      |

## How It Works

1. **CI creates a version** — Your build pipeline registers a new version with Ctrlplane
2. **Ctrlplane plans releases** — Based on environments and selectors, it creates release targets
3. **Policies are evaluated** — Approval gates, environment progression, gradual rollout rules
4. **Jobs execute** — Ctrlplane dispatches to your job agent (ArgoCD, K8s Jobs, GitHub Actions)
5. **Verification runs** — Metrics are checked; pass → promote, fail → rollback

## 📚 Documentation

- [Quickstart](https://docs.ctrlplane.dev/quickstart) — Deploy your first service in 15 minutes
- [Core Concepts](https://docs.ctrlplane.dev/concepts/overview) — Systems, deployments, environments, resources
- [Policies](https://docs.ctrlplane.dev/policies/overview) — Approvals, verification, gradual rollouts
- [Integrations](https://docs.ctrlplane.dev/integrations/cicd) — GitHub Actions, ArgoCD, Kubernetes

## 🛠️ Contributing

We welcome contributions! This section covers everything you need to get the project running locally and start contributing.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) engine installed and running
- [Flox](https://flox.dev/docs/install-flox/install/) installed (manages Node.js, pnpm, Go, and other tooling)
- [pnpm](https://pnpm.io/installation) (if not using Flox)
- [Go 1.22+](https://go.dev/dl/) (only needed if working on `workspace-engine` or `relay`)

### First-Time Setup

```bash
git clone https://github.com/ctrlplanedev/ctrlplane.git
cd ctrlplane

# Activate the Flox environment (installs all required tooling)
flox activate

# Start local services (PostgreSQL, etc.)
docker compose -f docker-compose.dev.yaml up -d

# Install dependencies and build all packages
pnpm i && pnpm build

# Apply database migrations
pnpm -F @ctrlplane/db migrate

# Start all dev servers
pnpm dev
```

> **Reset everything** (wipe volumes and start fresh):
> ```bash
> docker compose -f docker-compose.dev.yaml down -v
> docker compose -f docker-compose.dev.yaml up -d
> pnpm -F @ctrlplane/db migrate
> pnpm dev
> ```

### Day-to-Day Development

| Command | Description |
|---|---|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all TypeScript tests |
| `pnpm lint` | Lint all TypeScript code |
| `pnpm format:fix` | Auto-format all TypeScript code |
| `pnpm typecheck` | TypeScript type check across all packages |
| `pnpm -F <package> test` | Run tests for a specific package |
| `pnpm -F <package> test -- -t "test name"` | Run a specific test by name |

### Database

```bash
pnpm -F @ctrlplane/db migrate   # Run migrations
pnpm -F @ctrlplane/db push      # Apply schema changes without a migration file (dev only)
pnpm -F @ctrlplane/db studio    # Open Drizzle Studio UI
```

### E2E Tests (Playwright)

```bash
cd e2e
pnpm exec playwright test                                         # Run all e2e tests
pnpm exec playwright test tests/api/resources.spec.ts             # Run a specific file
pnpm test:api                                                     # Run all API tests
pnpm test:debug                                                   # Run in debug mode
```

### workspace-engine (Go)

```bash
cd apps/workspace-engine
go run ./...                          # Run without building
go build -o ./bin/workspace-engine .  # Build binary
go test ./...                         # Run tests
golangci-lint run                     # Lint
go fmt ./...                          # Format
```

### Monorepo Structure

```text
apps/
  api/              # Node.js/Express REST API — core business logic
  web/              # React 19 + React Router frontend
  workspace-engine/ # Go reconciliation engine
  relay/            # Go WebSocket relay for agent communication
packages/
  db/               # Drizzle ORM schema + migrations (PostgreSQL)
  trpc/             # tRPC server setup
  auth/             # Authentication integration
integrations/       # External service adapters
e2e/                # Playwright end-to-end tests
```

### Code Style

- **TypeScript**: explicit types, `interface` for public APIs, `async/await`, named imports
- **React**: functional components only, typed as `const Foo: React.FC<Props> = () => {}`
- **Tests**: vitest with typed fixtures
- **Go**: follow `apps/workspace-engine/CLAUDE.md` guidelines
- Run `pnpm lint` and `pnpm format:fix` before submitting a PR

### Opening a Pull Request

1. Fork the repo and create a branch from `main`
2. Make your changes, add tests where applicable
3. Run `pnpm test`, `pnpm lint`, and `pnpm typecheck` to verify everything passes
4. Open a PR against `main` with a clear description of what changed and why

## :heart: Community

- [GitHub Discussions](https://github.com/ctrlplanedev/ctrlplane/discussions)
- [Discord](https://ctrlplane.dev/discord)

Ask questions, report bugs, join discussions, voice ideas, make feature requests, or share your projects.

![Alt](https://repobeats.axiom.co/api/embed/354918f3c89424e9615c77d36b62aaeb67d9b7fb.svg "Repobeats analytics image")

## ⛓️ Security

If you believe you have found a security vulnerability, we encourage you to responsibly disclose this and not open a public issue.

Email `security@ctrlplane.dev` to disclose any security vulnerabilities.

---

### We couldn't have done this without you

<a href="https://github.com/ctrlplanedev/ctrlplane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ctrlplanedev/ctrlplane" />
</a>
