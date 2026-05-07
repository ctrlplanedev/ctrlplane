# AGENTS.md

Scoped guidance for `apps/workspace-engine`, the Go reconciliation engine.
Prefer this file over the legacy `CLAUDE.md` in this directory.

## Service purpose

`apps/workspace-engine` is the asynchronous reconciliation engine behind
Ctrlplane. The API writes desired state and enqueues work in Postgres; this
service claims work items, computes derived state, dispatches jobs, evaluates
policies, and schedules retries or follow-up reconciliation.

## Current layout

- `main.go`: service entry point and controller registration.
- `otel.go`: OpenTelemetry setup.
- `pkg/config`: environment configuration, including controller filtering.
- `pkg/db`: pgx pool, sqlc-generated queries, and DB conversion helpers.
- `pkg/db/queries`: SQL inputs for generated query code.
- `pkg/oapi`: generated OpenAPI types plus domain helpers.
- `oapi`: OpenAPI/jsonnet inputs and generated `openapi.json`.
- `pkg/reconcile`: generic work queue, worker loop, result handling, events,
  Postgres queue, and in-memory queue for tests.
- `pkg/selector`: selector evaluation.
- `pkg/celutil`: CEL helpers and SQL conversion.
- `pkg/policies`: policy evaluation and matching.
- `pkg/store`: data access and state loading helpers.
- `pkg/jobagents`: adapters for ArgoCD, Argo Workflows, GitHub, Terraform
  Cloud, test runner, and related job agent types.
- `svc`: service runner, HTTP/pprof support, claim cleanup, workspace ticker,
  and controllers.
- `svc/controllers`: one directory per reconciliation controller.
- `test`: controller and E2E test harnesses.
- `tools/seed`: local data seeding helpers.

## Commands

- `pnpm -F @ctrlplane/workspace-engine dev`: run with Air.
- `pnpm -F @ctrlplane/workspace-engine build`: build the binary.
- `pnpm -F @ctrlplane/workspace-engine test`: run `go test ./...`.
- `pnpm -F @ctrlplane/workspace-engine lint`: run `golangci-lint`.
- `pnpm -F @ctrlplane/workspace-engine lint:fix`: run lint fixes.
- `pnpm -F @ctrlplane/workspace-engine format`: run `go fmt ./...`.
- `pnpm -F @ctrlplane/workspace-engine generate`: run `go generate ./...`.
- From this directory, equivalent direct commands are `go test ./...`,
  `go fmt ./...`, `golangci-lint run --allow-parallel-runners`, and
  `go generate ./...`.

## Reconciliation architecture

- Controllers are independent workers. They communicate by writing domain state
  and enqueueing follow-up work, not by calling each other directly.
- Each controller implements the `reconcile.Processor` shape and processes one
  work kind.
- Workers claim batches from the queue, hold leases with heartbeats, process
  items, then ack success or retry with backoff.
- `Result.RequeueAfter` is the standard mechanism for scheduled polling or
  delayed retries.
- Postgres queue lease expiration lets another worker recover abandoned work.
- The `SERVICES` environment variable can run only a subset of controllers in a
  process.

## Controller groups

- Selector and relationship evaluation: `deploymentresourceselectoreval`,
  `environmentresourceselectoreval`, `relationshipeval`.
- Release planning: `deploymentplan`, `deploymentplanresult`,
  `desiredrelease`, `policyeval`, `forcedeploy`.
- Job execution and verification: `jobeligibility`, `jobdispatch`,
  `jobverificationmetric`.

## Controller conventions

- Keep controller logic isolated in its controller package.
- Use small `Getter` and `Setter` interfaces for database reads and writes.
- Put production DB implementations in `*_postgres.go` files.
- Unit-test controller logic with mocks or test stores when possible instead of
  requiring a real database.
- Do not introduce direct controller-to-controller calls. Enqueue follow-up
  work through `pkg/reconcile/events`.
- Keep work item scope identifiers stable and explicit: kind, scope type, scope
  id, workspace id, and priority/not-before when relevant.

## Go style

- Follow existing package patterns before adding new abstractions.
- Keep code `gofmt`-compliant.
- Prefer clear names over explanatory comments.
- Do not add comments that restate standard Go patterns or obvious code.
- Good comments explain why behavior exists, non-obvious business rules,
  algorithms, tradeoffs, exported APIs, or TODO/FIXME context.
- Preserve exact indentation style when editing nearby code.
- Avoid touching generated files unless the change requires regeneration.

## Testing guidance

- Use table-driven tests for condition, selector, policy, and conversion logic.
- Include edge cases for empty values, invalid identifiers, special characters,
  Unicode, nil/zero values, and conflicting policy outcomes when relevant.
- Test validation and matching/evaluation behavior separately when practical.
- For queue and controller changes, test success, retry, requeue, missing data,
  and idempotency paths.
- After Go changes, run targeted `go test` first, then broader package tests
  when feasible.
- Check and run lint/typecheck/format commands when they exist and are relevant
  to the edited code.

## Generated code

- SQL query files live in `pkg/db/queries`; generated Go query files live in
  `pkg/db`.
- OpenAPI/jsonnet inputs live under `oapi`; generated Go types live under
  `pkg/oapi`.
- Prefer changing source specs or SQL inputs, then regenerating, rather than
  hand-editing generated outputs.
