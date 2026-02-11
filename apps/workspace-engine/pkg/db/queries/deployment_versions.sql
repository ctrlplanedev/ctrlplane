-- name: GetDeploymentVersionByID :one
SELECT * FROM deployment_version WHERE id = $1;

-- name: ListDeploymentVersionsByDeploymentID :many
SELECT * FROM deployment_version WHERE deployment_id = $1 ORDER BY created_at DESC;

-- name: CreateDeploymentVersion :one
INSERT INTO deployment_version (name, tag, config, job_agent_config, deployment_id, status, message)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateDeploymentVersion :one
UPDATE deployment_version
SET name = $2, tag = $3, config = $4, job_agent_config = $5, status = $6, message = $7
WHERE id = $1
RETURNING *;

-- name: UpsertDeploymentVersion :one
INSERT INTO deployment_version (name, tag, config, job_agent_config, deployment_id, status, message)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (deployment_id, tag) DO UPDATE
SET name = EXCLUDED.name, config = EXCLUDED.config, job_agent_config = EXCLUDED.job_agent_config, status = EXCLUDED.status, message = EXCLUDED.message
RETURNING *;

-- name: DeleteDeploymentVersion :exec
DELETE FROM deployment_version WHERE id = $1;
