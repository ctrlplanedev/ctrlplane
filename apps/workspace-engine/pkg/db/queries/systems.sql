-- name: GetSystemByID :one
SELECT id, name, description, workspace_id, metadata FROM system WHERE id = $1;

-- name: ListSystemsByWorkspaceID :many
SELECT
    s.id,
    s.workspace_id,
    s.name,
    s.description,
    s.metadata
FROM system s
WHERE s.workspace_id = $1;

-- name: UpsertSystem :one
INSERT INTO system (id, name, description, workspace_id, metadata)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    workspace_id = EXCLUDED.workspace_id, metadata = EXCLUDED.metadata
RETURNING *;

-- name: DeleteSystem :exec
DELETE FROM system WHERE id = $1;
