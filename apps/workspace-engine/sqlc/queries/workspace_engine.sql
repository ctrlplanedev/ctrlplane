-- name: GetDeploymentByID :one
SELECT
    d.id,
    d.name,
    d.slug,
    d.description,
    d.system_id,
    d.job_agent_id,
    d.job_agent_config,
    d.retry_count,
    d.timeout,
    d.resource_selector
FROM deployment AS d
WHERE d.id = $1
LIMIT 1;

-- name: ListDeploymentsByWorkspace :many
SELECT
    d.id,
    d.name,
    d.slug,
    d.description,
    d.system_id,
    d.job_agent_id,
    d.job_agent_config,
    d.retry_count,
    d.timeout,
    d.resource_selector
FROM deployment AS d
INNER JOIN system AS s
    ON s.id = d.system_id
WHERE s.workspace_id = $1
ORDER BY d.name ASC;

-- name: UpsertDeployment :one
INSERT INTO deployment (
    id,
    name,
    slug,
    description,
    system_id,
    job_agent_id,
    job_agent_config,
    retry_count,
    timeout,
    resource_selector
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10
)
ON CONFLICT (id)
DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    system_id = EXCLUDED.system_id,
    job_agent_id = EXCLUDED.job_agent_id,
    job_agent_config = EXCLUDED.job_agent_config,
    retry_count = EXCLUDED.retry_count,
    timeout = EXCLUDED.timeout,
    resource_selector = EXCLUDED.resource_selector
RETURNING
    id,
    name,
    slug,
    description,
    system_id,
    job_agent_id,
    job_agent_config,
    retry_count,
    timeout,
    resource_selector;

-- name: ListEnvironmentsByWorkspace :many
SELECT
    e.id,
    e.name,
    e.system_id,
    e.created_at,
    e.description,
    e.resource_selector
FROM environment AS e
INNER JOIN system AS s
    ON s.id = e.system_id
WHERE s.workspace_id = $1
ORDER BY e.name ASC;

-- name: GetReleaseTargetID :one
SELECT
    rt.id
FROM release_target AS rt
WHERE rt.resource_id = $1
  AND rt.environment_id = $2
  AND rt.deployment_id = $3
LIMIT 1;

-- name: InsertReleaseTargetIfMissing :exec
INSERT INTO release_target (resource_id, environment_id, deployment_id)
VALUES ($1, $2, $3)
ON CONFLICT (resource_id, environment_id, deployment_id)
DO NOTHING;
