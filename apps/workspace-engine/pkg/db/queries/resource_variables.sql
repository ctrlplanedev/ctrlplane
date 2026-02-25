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
