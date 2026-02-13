-- name: GetEnvironmentByID :one
SELECT
    e.id,
    e.name,
    e.description,
    e.resource_selector,
    e.metadata,
    e.created_at,
    e.workspace_id,
    se.system_id
FROM environment e
LEFT JOIN system_environment se ON se.environment_id = e.id
WHERE e.id = $1;

-- name: ListEnvironmentsByWorkspaceID :many
SELECT
    e.id,
    e.name,
    e.description,
    e.resource_selector,
    e.metadata,
    e.created_at,
    e.workspace_id,
    se.system_id
FROM environment e
LEFT JOIN system_environment se ON se.environment_id = e.id
WHERE e.workspace_id = $1
ORDER BY e.created_at DESC
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: UpsertEnvironment :one
INSERT INTO environment (id, name, description, resource_selector, metadata, workspace_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    resource_selector = EXCLUDED.resource_selector, metadata = EXCLUDED.metadata,
    workspace_id = EXCLUDED.workspace_id,
    created_at = CASE WHEN sqlc.narg('created_at')::timestamptz IS NOT NULL THEN EXCLUDED.created_at ELSE environment.created_at END
RETURNING *;

-- name: UpsertSystemEnvironment :exec
INSERT INTO system_environment (system_id, environment_id)
VALUES ($1, $2)
ON CONFLICT (system_id, environment_id) DO NOTHING;

-- name: DeleteEnvironment :exec
DELETE FROM environment WHERE id = $1;
