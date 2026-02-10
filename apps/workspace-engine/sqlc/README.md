# sqlc setup for workspace-engine

This directory contains a ready-to-use `sqlc` setup for generating typed Go query code.

## Layout

- `../sqlc.yaml`: sqlc project config
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

## Verify against a live database

`sqlc generate` uses the `schema` path and does **not** need a database connection.

`database.uri` is used for database-backed checks (for example `sqlc verify`).

```bash
POSTGRES_URL="postgres://postgres:password@localhost:5432/postgres?sslmode=disable" \
  make sqlc-verify
```

## Adding new queries

1. Copy `templates/query.template.sql` into `queries/<feature>.sql`.
2. Rename query annotations (`-- name: ...`) to match your use case.
3. Keep query files focused by feature/domain.
4. Run `make sqlc-generate`.
5. Use generated methods from `pkg/db/sqlcgen`.
