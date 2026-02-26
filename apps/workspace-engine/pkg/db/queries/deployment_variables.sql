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

-- name: GetDeploymentVariableValueByID :one
SELECT id, deployment_variable_id, value, resource_selector, priority
FROM deployment_variable_value
WHERE id = $1;

-- name: ListDeploymentVariableValuesByVariableID :many
SELECT id, deployment_variable_id, value, resource_selector, priority
FROM deployment_variable_value
WHERE deployment_variable_id = $1;

-- name: UpsertDeploymentVariableValue :one
INSERT INTO deployment_variable_value (id, deployment_variable_id, value, resource_selector, priority)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET deployment_variable_id = EXCLUDED.deployment_variable_id, value = EXCLUDED.value,
    resource_selector = EXCLUDED.resource_selector, priority = EXCLUDED.priority
RETURNING *;

-- name: DeleteDeploymentVariableValue :exec
DELETE FROM deployment_variable_value WHERE id = $1;

-- name: ListDeploymentVariableValuesByWorkspaceID :many
SELECT dvv.id, dvv.deployment_variable_id, dvv.value, dvv.resource_selector, dvv.priority
FROM deployment_variable_value dvv
INNER JOIN deployment_variable dv ON dv.id = dvv.deployment_variable_id
INNER JOIN deployment d ON d.id = dv.deployment_id
WHERE d.workspace_id = $1;
