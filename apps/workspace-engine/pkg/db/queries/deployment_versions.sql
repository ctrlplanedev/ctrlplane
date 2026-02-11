-- name: GetDeploymentVersionByID :one
SELECT * FROM deployment_version WHERE id = $1;

-- name: ListDeploymentVersionsByDeploymentID :many
SELECT * FROM deployment_version WHERE deployment_id = $1 ORDER BY created_at DESC
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: UpsertDeploymentVersion :one
INSERT INTO deployment_version (name, tag, config, job_agent_config, deployment_id, status, message, workspace_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (deployment_id, tag) DO UPDATE
SET name = EXCLUDED.name, config = EXCLUDED.config, job_agent_config = EXCLUDED.job_agent_config, status = EXCLUDED.status, message = EXCLUDED.message, workspace_id = EXCLUDED.workspace_id
RETURNING *;

-- name: ListDeploymentVersionsByWorkspaceID :many
SELECT * FROM deployment_version
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: DeleteDeploymentVersion :exec
DELETE FROM deployment_version WHERE id = $1;
