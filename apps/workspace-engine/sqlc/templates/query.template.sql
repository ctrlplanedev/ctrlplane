-- Copy this file into sqlc/queries/<your_feature>.sql and update names/columns.
-- sqlc annotations:
--   :one      -> single row result
--   :many     -> slice result
--   :exec     -> no returned rows
--   :execrows -> rows affected (int64)

-- name: GetThingByID :one
SELECT
    t.id,
    t.name,
    t.created_at
FROM your_table AS t
WHERE t.id = $1
LIMIT 1;

-- name: ListThingsByWorkspace :many
SELECT
    t.id,
    t.name,
    t.created_at
FROM your_table AS t
WHERE t.workspace_id = $1
ORDER BY t.created_at DESC
LIMIT $2
OFFSET $3;

-- name: UpsertThing :one
INSERT INTO your_table (
    id,
    workspace_id,
    name
)
VALUES ($1, $2, $3)
ON CONFLICT (id)
DO UPDATE SET
    workspace_id = EXCLUDED.workspace_id,
    name = EXCLUDED.name
RETURNING
    id,
    workspace_id,
    name,
    created_at;

-- name: DeleteThingByID :execrows
DELETE FROM your_table
WHERE id = $1;
