# Contributing to `apps/workspace-engine`

This is the service guide for `apps/workspace-engine` — the Go reconciliation engine that turns user intent (a new version, a changed selector, a policy update) into concrete jobs dispatched to job agents. It assumes you've completed the root [CONTRIBUTING.md](../../CONTRIBUTING.md) setup and can run `pnpm dev` or `go run ./...` in this directory.

## Table of Contents

- [What This Service Does](#what-this-service-does)
- [Architecture](#architecture)
- [Directory Layout](#directory-layout)
- [Recipes](#recipes)
  - [Add a new controller](#add-a-new-controller)
  - [Enqueue work from another controller](#enqueue-work-from-another-controller)
  - [Use `RequeueAfter` for scheduled retries](#use-requeueafter-for-scheduled-retries)
  - [Write a unit test with mocks](#write-a-unit-test-with-mocks)
- [Running a Subset of Controllers Locally](#running-a-subset-of-controllers-locally)
- [Common Pitfalls](#common-pitfalls)

## What This Service Does

`apps/workspace-engine` is the **asynchronous brain** behind Ctrlplane. The API records what the user wants (state in Postgres) and enqueues a work item; this service picks up that item, computes the consequences, and either writes derived state back or enqueues further work for the next controller.

Controllers are grouped by concern. Roughly, work flows top-to-bottom: selectors decide which resources are in scope, planning (including policy evaluation) decides what gets released where, and the job execution group runs and verifies the resulting jobs.

### Selector & relationship evaluation

Decide **which resources belong where** — recomputed whenever a selector or relationship rule changes, or when a resource's metadata changes.

| Controller                        | Responsibility                                              |
| --------------------------------- | ----------------------------------------------------------- |
| `deploymentresourceselectoreval`  | Recompute which resources match a deployment's selector     |
| `environmentresourceselectoreval` | Recompute which resources match an environment's selector   |
| `relationshipeval`                | Evaluate resource relationship rules                        |

### Release planning

Turn intent (a new version, a changed selector, a policy update) into **which release should be deployed to each release target**. Policy evaluation lives here because policies determine *what* gets released — approvals, environment progression, rollout sequencing — not whether a specific job can run.

| Controller             | Responsibility                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| `deploymentplan`       | Fan a deployment plan into per-(environment, resource, agent) work |
| `deploymentplanresult` | Materialize the final release row from a plan result               |
| `desiredrelease`       | Pick the target version for each release target                    |
| `policyeval`           | Evaluate policy rules (approvals, progression, windows, rollout)   |
| `forcedeploy`          | Handle manual force-deploy requests                                |

### Job execution & verification

Once a release is decided, **run the job and track its outcome**.

| Controller              | Responsibility                                          |
| ----------------------- | ------------------------------------------------------- |
| `jobeligibility`        | Check whether a job is ready to run                     |
| `jobdispatch`           | Route an eligible job to the right job agent            |
| `jobverificationmetric` | Poll verification metrics (Datadog, Prometheus, HTTP)   |

The engine is **horizontally scalable** — every controller is a standalone worker, multiple instances can run simultaneously, and lease-based locking in the queue prevents duplicate processing.

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         apps/workspace-engine                        │
│                                                                      │
│  main.go                                                             │
│    │                                                                 │
│    └─► svc.Runner — manages lifecycle (start / signal / stop)        │
│         │                                                            │
│         ├─► pprof, HTTP server, claim cleanup                        │
│         └─► controllers (each is a svc.Service wrapping a Worker)    │
│                                                                      │
│           ┌────────────────── Worker ──────────────────┐             │
│           │  1. Claim(batch) from queue                │             │
│           │  2. For each item, spawn goroutine:        │             │
│           │     - start lease heartbeat                │             │
│           │     - call processor.Process(ctx, item)    │             │
│           │     - AckSuccess / Retry (with backoff)    │             │
│           │     - if RequeueAfter > 0: re-enqueue      │             │
│           └────────────────────────────────────────────┘             │
│                            ▲                                         │
│                            │ reconcile.Processor                     │
│                            │                                         │
│           ┌────────────────┴────────────────┐                        │
│           │  Controller (per kind)          │                        │
│           │   - Getter   interface          │                        │
│           │   - Setter   interface          │                        │
│           │   - Process(ctx, item) Result   │                        │
│           └─────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
                             ▲
                             │
                   ┌─────────┴─────────┐
                   │ Postgres queue    │
                   │ reconcile_work_   │
                   │ scope             │
                   └───────────────────┘
```

**Key design decisions:**

- **Controllers are independent.** Each controller claims from one kind of work and writes its output either to domain tables or as enqueues for the next kind. No direct controller-to-controller calls.
- **Dependency injection via `Getter` / `Setter` interfaces.** Every controller defines `Getter` (reads) and `Setter` (writes) interfaces, with a `*Postgres` implementation for production and mocks for tests. This lets us unit-test controllers without a real database.
- **Lease-based locking.** When a worker claims an item, it holds a lease that it heartbeats periodically. If the worker crashes, the lease expires and another worker picks the item up. Duplicate processing is prevented without distributed locks.
- **`Result.RequeueAfter`** lets a controller ask to be run again later (e.g. polling a verification metric every 30s) without manual enqueue.
- **No controller-to-agent communication in-process.** Job agents (GitHub Actions, ArgoCD, etc.) are reached via the external APIs they expose; this service never holds long-lived connections to them.

## Directory Layout

```text
apps/workspace-engine/
├── main.go                    # Entry point — registers every controller
├── otel.go                    # OpenTelemetry setup
├── go.mod / go.sum
├── oapi/                      # OpenAPI-generated types (shared domain objects)
├── pkg/
│   ├── config/                # env var config (incl. SERVICES filter)
│   ├── db/                    # pgx pool, sqlc-generated queries
│   ├── oapi/                  # Domain types (Deployment, Release, etc.)
│   ├── reconcile/             # Work queue + worker loop (generic, reusable)
│   │   ├── workqueue.go       # Queue interface, Item, EnqueueParams, …
│   │   ├── worker.go          # Claim → process → ack/retry loop
│   │   ├── events/            # Per-kind Kind constants + Enqueue helpers
│   │   ├── postgres/          # Queue impl backed by reconcile_work_scope
│   │   └── memory/            # In-memory queue impl (for tests)
│   ├── selector/              # CEL selector evaluation
│   ├── policies/              # Policy rule evaluation
│   ├── store/                 # In-memory snapshots / caches
│   └── jobagents/             # Job agent adapters (GHA, Argo, TFC, K8s, …)
└── svc/
    ├── service.go             # svc.Service interface + svc.Runner
    ├── http/                  # Admin / debug HTTP server
    ├── pprof/                 # pprof endpoint
    ├── claimcleanup/          # Periodic cleanup of expired leases
    └── controllers/           # One directory per controller
        └── <name>/
            ├── controller.go         # Process() implementation
            ├── controller_test.go    # Unit tests with mocks
            ├── getters.go            # Getter interface definition
            ├── getters_postgres.go   # Postgres impl
            ├── setters.go            # Setter interface definition
            └── setters_postgres.go   # Postgres impl
```

## Recipes

### Add a new controller

Adding a controller is the most common substantial change. The pattern has six pieces — mirror what `deploymentplan` already does.

**1. Declare the kind.** In `pkg/reconcile/events/`, add a file for your kind:

```go
// pkg/reconcile/events/myfeature.go
package events

import (
    "context"
    "workspace-engine/pkg/reconcile"
)

const MyFeatureKind = "my-feature"

type MyFeatureParams struct {
    WorkspaceID string
    TargetID    string
}

func EnqueueMyFeature(queue reconcile.Queue, ctx context.Context, params MyFeatureParams) error {
    return queue.Enqueue(ctx, reconcile.EnqueueParams{
        WorkspaceID: params.WorkspaceID,
        Kind:        MyFeatureKind,
        ScopeType:   "my-feature",
        ScopeID:     params.TargetID,
    })
}
```

The `Kind` string is what the worker polls for; `ScopeType` + `ScopeID` identify the entity being reconciled.

**2. Define the `Getter` / `Setter` interfaces.** Create a new controller directory and split read/write concerns:

```go
// svc/controllers/myfeature/getters.go
package myfeature

import (
    "context"
    "github.com/google/uuid"
    "workspace-engine/pkg/oapi"
)

type Getter interface {
    GetTarget(ctx context.Context, id uuid.UUID) (*oapi.MyTarget, error)
}
```

```go
// svc/controllers/myfeature/setters.go
package myfeature

import "context"

type Setter interface {
    MarkTargetProcessed(ctx context.Context, id string) error
}
```

**3. Implement the Postgres getters/setters.** Put the production versions in `getters_postgres.go` / `setters_postgres.go`. These wrap `db.GetQueries(ctx)` (sqlc-generated) and implement the interfaces above.

**4. Write the `Controller`.** Implement `reconcile.Processor`:

```go
// svc/controllers/myfeature/controller.go
package myfeature

import (
    "context"
    "fmt"

    "github.com/google/uuid"
    "go.opentelemetry.io/otel"
    "workspace-engine/pkg/reconcile"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/myfeature")

var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
    getter Getter
    setter Setter
}

func NewController(getter Getter, setter Setter) *Controller {
    return &Controller{getter: getter, setter: setter}
}

func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
    ctx, span := tracer.Start(ctx, "myfeature.Controller.Process")
    defer span.End()

    targetID, err := uuid.Parse(item.ScopeID)
    if err != nil {
        return reconcile.Result{}, fmt.Errorf("parse target id: %w", err)
    }

    target, err := c.getter.GetTarget(ctx, targetID)
    if err != nil {
        return reconcile.Result{}, fmt.Errorf("get target: %w", err)
    }

    // ... do the work ...

    if err := c.setter.MarkTargetProcessed(ctx, item.ScopeID); err != nil {
        return reconcile.Result{}, fmt.Errorf("mark processed: %w", err)
    }

    return reconcile.Result{}, nil
}
```

**5. Wire up the `svc.Service` factory.** Add a `New(workerID, pgxPool)` function:

```go
// svc/controllers/myfeature/controller.go (continued)
import (
    "time"
    "github.com/charmbracelet/log"
    "github.com/jackc/pgx/v5/pgxpool"
    "workspace-engine/pkg/config"
    "workspace-engine/pkg/reconcile/events"
    "workspace-engine/pkg/reconcile/postgres"
    "workspace-engine/svc"
)

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
    kind := events.MyFeatureKind
    nodeConfig := reconcile.NodeConfig{
        WorkerID:        workerID,
        BatchSize:       10,
        PollInterval:    1 * time.Second,
        LeaseDuration:   30 * time.Second,
        LeaseHeartbeat:  15 * time.Second,
        MaxConcurrency:  config.GetMaxConcurrency(kind),
        MaxRetryBackoff: 10 * time.Second,
    }
    queue := postgres.NewForKinds(pgxPool, kind)

    controller := &Controller{
        getter: &PostgresGetter{},
        setter: &PostgresSetter{},
    }

    worker, err := reconcile.NewWorker(kind, queue, controller, nodeConfig)
    if err != nil {
        log.Fatal("failed to create myfeature worker", "error", err)
    }
    return worker
}
```

**6. Register it in `main.go`.** Add the import and the constructor call to the `allServices` slice:

```go
import "workspace-engine/svc/controllers/myfeature"

// inside main()
allServices := []svc.Service{
    // ...
    myfeature.New(WorkerID, db.GetPool(ctx)),
}
```

The `SERVICES` env var will now include `my-feature` as a toggleable kind.

### Enqueue work from another controller

When controller A produces work for controller B, A's `Setter` enqueues into B's kind. The pattern:

```go
// In the setter implementation for controller A
func (s *PostgresSetter) enqueueFollowUp(ctx context.Context, workspaceID, targetID string) error {
    return events.EnqueueMyFeature(s.queue, ctx, events.MyFeatureParams{
        WorkspaceID: workspaceID,
        TargetID:    targetID,
    })
}
```

Hold a `reconcile.Queue` on the setter (see `deploymentplan`'s `PostgresSetter` for the reference pattern — it takes the shared queue in the constructor).

### Use `RequeueAfter` for scheduled retries

For controllers that need to poll something (verification metrics, external API state), return a non-zero `RequeueAfter`:

```go
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
    status, err := c.getter.CheckMetric(ctx, item.ScopeID)
    if err != nil {
        return reconcile.Result{}, err // normal error → exponential backoff retry
    }

    if status == StatusPending {
        return reconcile.Result{RequeueAfter: 30 * time.Second}, nil
    }

    // Terminal state — don't requeue
    return reconcile.Result{}, nil
}
```

`RequeueAfter` is different from returning an error: the item is **acked as successful**, then a new item is enqueued with `NotBefore = now + RequeueAfter`. No attempt counter increment, no exponential backoff.

### Write a unit test with mocks

Every controller should have a `controller_test.go` that exercises `Process()` against mock `Getter` / `Setter` implementations. The pattern used throughout the codebase:

```go
// svc/controllers/myfeature/controller_test.go
package myfeature

import (
    "context"
    "testing"

    "github.com/google/uuid"
    "github.com/stretchr/testify/require"
    "workspace-engine/pkg/reconcile"
)

type mockGetter struct {
    target    *oapi.MyTarget
    targetErr error
}

func (m *mockGetter) GetTarget(_ context.Context, _ uuid.UUID) (*oapi.MyTarget, error) {
    return m.target, m.targetErr
}

type mockSetter struct {
    processedIDs []string
    err          error
}

func (m *mockSetter) MarkTargetProcessed(_ context.Context, id string) error {
    if m.err != nil {
        return m.err
    }
    m.processedIDs = append(m.processedIDs, id)
    return nil
}

func TestProcess_HappyPath(t *testing.T) {
    targetID := uuid.New()
    getter := &mockGetter{target: &oapi.MyTarget{ID: targetID}}
    setter := &mockSetter{}

    c := NewController(getter, setter)
    _, err := c.Process(context.Background(), reconcile.Item{
        ScopeID: targetID.String(),
    })

    require.NoError(t, err)
    require.Equal(t, []string{targetID.String()}, setter.processedIDs)
}
```

Use `testify/require` when a failure should abort the test (setup invariants) and `testify/assert` when the test should continue to check other conditions. Prefer **table-driven tests** when you have more than two or three scenarios — see `deploymentplan/controller_test.go` for a fully worked example.

## Running a Subset of Controllers Locally

Controllers are expensive — running all of them locally spins up N polling goroutines against Postgres. While developing one, set `SERVICES` in `.env` to just the kinds you need:

```bash
# Only the two you're iterating on, plus the infra services
SERVICES=deployment-plan,policy-eval
```

The kind names match the `Name()` returned by each worker (which comes from the `Kind` constant in `events/`).

Use [air](https://github.com/cosmtrek/air) for hot reload — `.air.toml` is already configured:

```bash
pnpm -F @ctrlplane/workspace-engine dev   # runs `air`
```

For debugging, the pprof server is available at `http://localhost:6060/debug/pprof/` by default.

## Common Pitfalls

- **Blocking work on the queue poll path.** `Process()` runs in its own goroutine with a lease heartbeat, so blocking is fine — **don't** sleep or block in getter/setter constructors, which run at startup.
- **Forgetting to register the controller in `main.go`.** The controller's package compiles fine in isolation, but if it's not in `allServices`, it never runs. Symptom: work piles up in `reconcile_work_scope` with no worker claiming it.
- **Returning an error when you meant `RequeueAfter`.** Errors go through exponential backoff and increment the attempt counter. Polling situations (verification, external state) should return `Result{RequeueAfter: …}` with `nil` error so the item isn't treated as a failure.
- **Using `context.Background()` in production paths.** The `ctx` passed to `Process()` carries tracing and cancellation. Propagate it to every getter/setter call. Only use `context.Background()` in `New(…)` startup wiring (e.g. the one-time `db.GetQueries` call).
- **Leaking the lease.** Don't spawn goroutines from `Process()` that outlive the function return — the lease heartbeat stops when `Process()` returns, and any work still running loses its claim. If you need fan-out, either wait for all child goroutines before returning, or enqueue them as separate work items.
- **Tight coupling between controllers.** Controller A should never import controller B's types. They communicate only through the queue (and the domain tables). If two controllers need to share logic, lift it into `pkg/`.
- **Postgres getters without workspace scoping.** Every query should include `workspace_id` in its `WHERE` clause — the queue items carry `WorkspaceID` for exactly this reason. Missing it is a cross-tenant data leak.
- **Racing `SERVICES` with a controller someone else depends on.** If you run only `deployment-plan` locally but not `deployment-plan-result`, your plan output will sit in the queue forever. Check what enqueues what before narrowing `SERVICES`.
