-- name: GetDeploymentByID :one
SELECT
    d.id,
    d.name,
    d.description,
    d.job_agent_id,
    d.job_agent_config,
    d.resource_selector,
    d.metadata,
    d.workspace_id,
    sd.system_id
FROM deployment d
LEFT JOIN system_deployment sd ON sd.deployment_id = d.id
WHERE d.id = $1;

-- name: ListDeploymentsByWorkspaceID :many
SELECT
    d.id,
    d.name,
    d.description,
    d.job_agent_id,
    d.job_agent_config,
    d.resource_selector,
    d.metadata,
    d.workspace_id,
    sd.system_id
FROM deployment d
LEFT JOIN system_deployment sd ON sd.deployment_id = d.id
WHERE d.workspace_id = $1
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: UpsertDeployment :one
INSERT INTO deployment (id, name, description, job_agent_id, job_agent_config, resource_selector, metadata, workspace_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, job_agent_id = EXCLUDED.job_agent_id,
    job_agent_config = EXCLUDED.job_agent_config, resource_selector = EXCLUDED.resource_selector,
    metadata = EXCLUDED.metadata, workspace_id = EXCLUDED.workspace_id
RETURNING *;

-- name: UpsertSystemDeployment :exec
INSERT INTO system_deployment (system_id, deployment_id)
VALUES ($1, $2)
ON CONFLICT (system_id, deployment_id) DO NOTHING;

-- name: DeleteDeployment :exec
DELETE FROM deployment WHERE id = $1;
