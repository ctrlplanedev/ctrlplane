-- name: GetDeploymentVariableByID :one
SELECT id, deployment_id, key, description, default_value
FROM deployment_variable
WHERE id = $1;

-- name: ListDeploymentVariablesByDeploymentID :many
SELECT id, deployment_id, key, description, default_value
FROM deployment_variable
WHERE deployment_id = $1;

-- name: UpsertDeploymentVariable :one
INSERT INTO deployment_variable (id, deployment_id, key, description, default_value)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET deployment_id = EXCLUDED.deployment_id, key = EXCLUDED.key,
    description = EXCLUDED.description, default_value = EXCLUDED.default_value
RETURNING *;

-- name: DeleteDeploymentVariable :exec
DELETE FROM deployment_variable WHERE id = $1;

-- name: ListDeploymentVariablesByWorkspaceID :many
SELECT dv.id, dv.deployment_id, dv.key, dv.description, dv.default_value
FROM deployment_variable dv
INNER JOIN deployment d ON d.id = dv.deployment_id
WHERE d.workspace_id = $1;
