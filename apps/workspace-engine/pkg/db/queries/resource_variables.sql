-- name: GetResourceVariable :one
SELECT resource_id, key, value
FROM resource_variable
WHERE resource_id = $1 AND key = $2;

-- name: UpsertResourceVariable :exec
INSERT INTO resource_variable (resource_id, key, value)
VALUES ($1, $2, $3)
ON CONFLICT (resource_id, key) DO UPDATE
SET value = EXCLUDED.value;

-- name: DeleteResourceVariable :exec
DELETE FROM resource_variable
WHERE resource_id = $1 AND key = $2;

-- name: ListResourceVariablesByResourceID :many
SELECT resource_id, key, value
FROM resource_variable
WHERE resource_id = $1;

-- name: DeleteResourceVariablesByResourceID :exec
DELETE FROM resource_variable
WHERE resource_id = $1;

-- name: ListResourceVariablesByWorkspaceID :many
SELECT rv.resource_id, rv.key, rv.value
FROM resource_variable rv
INNER JOIN resource r ON r.id = rv.resource_id
WHERE r.workspace_id = $1;
