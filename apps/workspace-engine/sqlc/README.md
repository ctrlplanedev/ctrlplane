# sqlc setup for workspace-engine

This directory contains a ready-to-use `sqlc` setup for generating typed Go query code.

## Layout

- `../sqlc.yaml`: sqlc project config
- `schema/workspace_engine.sql`: schema snapshot used by sqlc code generation
- `queries/workspace_engine.sql`: starter queries for workspace-engine tables
- `templates/query.template.sql`: copy/paste template for new query files
- `templates/schema.template.sql`: minimal schema template for isolated local experiments

Generated code is written to:

- `../pkg/db/sqlcgen`

## Generate code

From `apps/workspace-engine`:

```bash
make sqlc-generate
```

Or directly:

```bash
$(go env GOPATH)/bin/sqlc generate -f sqlc.yaml
```

## Validate parsing/codegen

```bash
make sqlc-compile
```

## Keeping schema current

The `schema/workspace_engine.sql` file is a stable schema snapshot for sqlc.
When Drizzle migrations change tables used by sqlc queries, update this snapshot.

## Verification modes

`sqlc generate` and `sqlc compile` use the local `schema` file and do **not** need
a database connection.

`sqlc verify` is a sqlc Cloud workflow and requires cloud project configuration.
`make sqlc-verify` runs local compile checks and prints the cloud verify command.

## Adding new queries

1. Copy `templates/query.template.sql` into `queries/<feature>.sql`.
2. Rename query annotations (`-- name: ...`) to match your use case.
3. Keep query files focused by feature/domain.
4. Run `make sqlc-generate`.
5. Use generated methods from `pkg/db/sqlcgen`.
