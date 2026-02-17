-- name: GetResourceProviderByID :one
SELECT id, name, workspace_id, created_at, metadata
FROM resource_provider
WHERE id = $1;

-- name: ListResourceProvidersByWorkspaceID :many
SELECT id, name, workspace_id, created_at, metadata
FROM resource_provider
WHERE workspace_id = $1;

-- name: UpsertResourceProvider :one
INSERT INTO resource_provider (id, name, workspace_id, created_at, metadata)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, metadata = EXCLUDED.metadata
RETURNING *;

-- name: DeleteResourceProvider :exec
DELETE FROM resource_provider WHERE id = $1;
