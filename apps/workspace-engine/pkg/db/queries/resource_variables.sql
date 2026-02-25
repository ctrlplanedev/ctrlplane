-- name: GetResourceVariable :one
SELECT resource_id, key, value, workspace_id
FROM resource_variable
WHERE resource_id = $1 AND key = $2;

-- name: UpsertResourceVariable :exec
INSERT INTO resource_variable (resource_id, key, value, workspace_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (resource_id, key) DO UPDATE
SET value = EXCLUDED.value;

-- name: DeleteResourceVariable :exec
DELETE FROM resource_variable
WHERE resource_id = $1 AND key = $2;

-- name: ListResourceVariablesByResourceID :many
SELECT resource_id, key, value, workspace_id
FROM resource_variable
WHERE resource_id = $1;

-- name: ListResourceVariablesByWorkspaceID :many
SELECT resource_id, key, value, workspace_id
FROM resource_variable
WHERE workspace_id = $1;

-- name: DeleteResourceVariablesByResourceID :exec
DELETE FROM resource_variable
WHERE resource_id = $1;
