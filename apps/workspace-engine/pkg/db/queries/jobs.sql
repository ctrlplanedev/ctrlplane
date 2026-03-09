-- name: InsertJob :exec
INSERT INTO job (id, job_agent_id, job_agent_config, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: InsertReleaseJob :exec
INSERT INTO release_job (release_id, job_id) VALUES ($1, $2);

-- name: GetWorkspaceIDByReleaseID :one
SELECT d.workspace_id
FROM release r
JOIN deployment d ON d.id = r.deployment_id
WHERE r.id = $1;

-- name: GetJobByID :one
SELECT
  j.id,
  j.job_agent_id,
  j.job_agent_config,
  j.external_id,
  j.status,
  j.message,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.updated_at,
  j.dispatch_context,
  rj.release_id,
  COALESCE(
    (SELECT json_agg(json_build_object('key', m.key, 'value', m.value))
     FROM job_metadata m WHERE m.job_id = j.id),
    '[]'
  )::jsonb AS metadata
FROM job j
LEFT JOIN release_job rj ON rj.job_id = j.id
WHERE j.id = $1;

-- name: UpsertJob :exec
INSERT INTO job (id, job_agent_id, job_agent_config, external_id, status, message, created_at, started_at, completed_at, updated_at, dispatch_context)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (id) DO UPDATE
SET job_agent_id = EXCLUDED.job_agent_id,
    job_agent_config = EXCLUDED.job_agent_config,
    external_id = EXCLUDED.external_id,
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    updated_at = EXCLUDED.updated_at,
    dispatch_context = EXCLUDED.dispatch_context;

-- name: UpsertJobMetadata :exec
INSERT INTO job_metadata (job_id, key, value)
VALUES ($1, $2, $3)
ON CONFLICT (job_id, key) DO UPDATE
SET value = EXCLUDED.value;

-- name: UpdateJobStatus :exec
UPDATE job
SET status = $2,
    message = $3,
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteJobMetadataByJobID :exec
DELETE FROM job_metadata WHERE job_id = $1;

-- name: DeleteJobByID :exec
DELETE FROM job WHERE id = $1;

-- name: ListJobsByWorkspaceID :many
SELECT
  j.id,
  j.job_agent_id,
  j.job_agent_config,
  j.external_id,
  j.status,
  j.message,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.updated_at,
  j.dispatch_context,
  rj.release_id,
  COALESCE(
    (SELECT json_agg(json_build_object('key', m.key, 'value', m.value))
     FROM job_metadata m WHERE m.job_id = j.id),
    '[]'
  )::jsonb AS metadata
FROM job j
JOIN release_job rj ON rj.job_id = j.id
JOIN release r ON r.id = rj.release_id
JOIN deployment d ON d.id = r.deployment_id
WHERE d.workspace_id = $1;

-- name: ListJobsByAgentID :many
SELECT
  j.id,
  j.job_agent_id,
  j.job_agent_config,
  j.external_id,
  j.status,
  j.message,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.updated_at,
  j.dispatch_context,
  rj.release_id,
  COALESCE(
    (SELECT json_agg(json_build_object('key', m.key, 'value', m.value))
     FROM job_metadata m WHERE m.job_id = j.id),
    '[]'
  )::jsonb AS metadata
FROM job j
LEFT JOIN release_job rj ON rj.job_id = j.id
WHERE j.job_agent_id = $1;

-- name: GetLatestCompletedJobForReleaseTarget :one
-- Returns the most recently completed job for a given release target
-- (deployment, environment, resource triple).
SELECT
  j.id,
  j.job_agent_id,
  j.job_agent_config,
  j.external_id,
  j.status,
  j.message,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.updated_at,
  j.dispatch_context,
  rj.release_id,
  COALESCE(
    (SELECT json_agg(json_build_object('key', m.key, 'value', m.value))
     FROM job_metadata m WHERE m.job_id = j.id),
    '[]'
  )::jsonb AS metadata
FROM job j
JOIN release_job rj ON rj.job_id = j.id
JOIN release r ON r.id = rj.release_id
WHERE r.deployment_id = @deployment_id
  AND r.environment_id = @environment_id
  AND r.resource_id = @resource_id
  AND j.completed_at IS NOT NULL
ORDER BY j.completed_at DESC
LIMIT 1;

-- name: ListJobsByReleaseTarget :many
-- Returns all jobs for a given release target (deployment, environment, resource triple).
SELECT
  j.id,
  j.job_agent_id,
  j.job_agent_config,
  j.external_id,
  j.status,
  j.message,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.updated_at,
  j.dispatch_context,
  rj.release_id,
  COALESCE(
    (SELECT json_agg(json_build_object('key', m.key, 'value', m.value))
     FROM job_metadata m WHERE m.job_id = j.id),
    '[]'
  )::jsonb AS metadata
FROM job j
JOIN release_job rj ON rj.job_id = j.id
JOIN release r ON r.id = rj.release_id
WHERE r.deployment_id = @deployment_id
  AND r.environment_id = @environment_id
  AND r.resource_id = @resource_id;

-- name: ListJobsByReleaseID :many
SELECT
  j.id,
  j.job_agent_id,
  j.job_agent_config,
  j.external_id,
  j.status,
  j.message,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.updated_at,
  j.dispatch_context,
  rj.release_id,
  COALESCE(
    (SELECT json_agg(json_build_object('key', m.key, 'value', m.value))
     FROM job_metadata m WHERE m.job_id = j.id),
    '[]'
  )::jsonb AS metadata
FROM job j
JOIN release_job rj ON rj.job_id = j.id
WHERE rj.release_id = $1;
