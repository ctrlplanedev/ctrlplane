-- name: GetEnvironmentByID :one
SELECT id, name, description, resource_selector, metadata, created_at, workspace_id
FROM environment
WHERE id = $1;

-- name: ListEnvironmentsByWorkspaceID :many
SELECT id, name, description, resource_selector, metadata, created_at, workspace_id
FROM environment
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: ListEnvironmentsBySystemID :many
SELECT e.id, e.name, e.description, e.resource_selector, e.metadata, e.created_at, e.workspace_id
FROM environment e
INNER JOIN system_environment se ON se.environment_id = e.id
WHERE se.system_id = $1;

-- name: UpsertEnvironment :one
INSERT INTO environment (id, name, description, resource_selector, metadata, workspace_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    resource_selector = EXCLUDED.resource_selector, metadata = EXCLUDED.metadata,
    workspace_id = EXCLUDED.workspace_id,
    created_at = CASE WHEN sqlc.narg('created_at')::timestamptz IS NOT NULL THEN EXCLUDED.created_at ELSE environment.created_at END
RETURNING *;

-- name: GetSystemIDForEnvironment :one
SELECT system_id FROM system_environment WHERE environment_id = $1 LIMIT 1;

-- name: UpsertSystemEnvironment :exec
INSERT INTO system_environment (system_id, environment_id)
VALUES ($1, $2)
ON CONFLICT (system_id, environment_id) DO NOTHING;

-- name: DeleteSystemEnvironmentByEnvironmentID :exec
DELETE FROM system_environment WHERE environment_id = $1;

-- name: DeleteEnvironment :exec
DELETE FROM environment WHERE id = $1;
