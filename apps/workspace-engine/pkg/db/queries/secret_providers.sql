-- name: GetSecretProviderByName :one
SELECT id, workspace_id, name, type, config, created_at, updated_at
FROM secret_provider
WHERE workspace_id = $1 AND name = $2;

-- name: ListSecretProvidersByWorkspaceID :many
SELECT id, workspace_id, name, type, config, created_at, updated_at
FROM secret_provider
WHERE workspace_id = $1
ORDER BY name;
