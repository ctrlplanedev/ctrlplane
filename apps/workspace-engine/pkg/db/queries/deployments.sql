-- name: GetDeploymentByID :one
SELECT *
FROM deployment
WHERE id = $1;


-- name: ListDeploymentsByWorkspaceID :many
SELECT *
FROM deployment
WHERE workspace_id = $1
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: ListDeploymentsBySystemID :many
SELECT d.id, d.name, d.description, d.resource_selector, d.metadata, d.workspace_id
FROM deployment d
INNER JOIN system_deployment sd ON sd.deployment_id = d.id
WHERE sd.system_id = $1;

-- name: UpsertDeployment :one
INSERT INTO deployment (id, name, description, resource_selector, metadata, workspace_id)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    resource_selector = EXCLUDED.resource_selector,
    metadata = EXCLUDED.metadata, workspace_id = EXCLUDED.workspace_id
RETURNING *;

-- name: GetSystemIDsForDeployment :many
SELECT system_id FROM system_deployment WHERE deployment_id = $1;

-- name: GetSystemsByDeploymentIDs :many
SELECT sd.deployment_id, s.*
FROM system_deployment sd
INNER JOIN system s ON s.id = sd.system_id
WHERE sd.deployment_id = ANY(@deployment_ids::uuid[]);

-- name: UpsertSystemDeployment :exec
INSERT INTO system_deployment (system_id, deployment_id)
VALUES ($1, $2)
ON CONFLICT (system_id, deployment_id) DO NOTHING;

-- name: DeleteSystemDeploymentByDeploymentID :exec
DELETE FROM system_deployment WHERE deployment_id = $1;

-- name: DeleteSystemDeployment :exec
DELETE FROM system_deployment WHERE system_id = $1 AND deployment_id = $2;

-- name: GetDeploymentIDsForSystem :many
SELECT deployment_id FROM system_deployment WHERE system_id = $1;

-- name: DeleteDeployment :exec
DELETE FROM deployment WHERE id = $1;

-- name: GetDeploymentDependenciesByDeploymentID :many
SELECT dependency_deployment_id, version_selector
FROM deployment_dependency
WHERE deployment_id = $1
ORDER BY dependency_deployment_id;

