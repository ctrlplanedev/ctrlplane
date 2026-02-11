-- name: GetDeploymentVersionByID :one
SELECT * FROM deployment_version WHERE id = $1;

-- name: ListDeploymentVersionsByDeploymentID :many
SELECT * FROM deployment_version WHERE deployment_id = $1 ORDER BY created_at DESC;

-- name: UpsertDeploymentVersion :one
INSERT INTO deployment_version (name, tag, config, job_agent_config, deployment_id, status, message)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (deployment_id, tag) DO UPDATE
SET name = EXCLUDED.name, config = EXCLUDED.config, job_agent_config = EXCLUDED.job_agent_config, status = EXCLUDED.status, message = EXCLUDED.message
RETURNING *;

-- name: ListDeploymentVersionsByWorkspaceID :many
SELECT dv.* FROM deployment_version dv
JOIN deployment d ON dv.deployment_id = d.id
JOIN system s ON d.system_id = s.id
WHERE s.workspace_id = $1
ORDER BY dv.created_at DESC;

-- name: DeleteDeploymentVersion :exec
DELETE FROM deployment_version WHERE id = $1;
