-- name: GetJobByID :one
SELECT * FROM job WHERE id = $1;

-- name: ListJobsByWorkspaceID :many
SELECT j.*
FROM job j
JOIN release r ON r.id = j.release_id
JOIN deployment d ON d.id = r.deployment_id
WHERE d.workspace_id = $1
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: ListJobsByReleaseID :many
SELECT * FROM job WHERE release_id = $1;

-- name: ListJobsByJobAgentID :many
SELECT * FROM job WHERE job_agent_id = $1;

-- name: ListJobsByWorkflowJobID :many
SELECT * FROM job WHERE workflow_job_id = $1;

-- name: ListJobsByStatusAndWorkspace :many
SELECT j.*
FROM job j
JOIN release r ON r.id = j.release_id
JOIN deployment d ON d.id = r.deployment_id
WHERE j.status = $1 AND d.workspace_id = $2;

-- name: UpsertJob :one
INSERT INTO job (
    id, release_id, job_agent_id, workflow_job_id,
    status, reason, external_id, message, trace_token,
    job_agent_config, dispatch_context, metadata,
    created_at, updated_at, started_at, completed_at
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8, $9,
    $10, $11, $12,
    COALESCE(sqlc.narg('created_at')::timestamptz, NOW()),
    COALESCE(sqlc.narg('updated_at')::timestamptz, NOW()),
    sqlc.narg('started_at')::timestamptz,
    sqlc.narg('completed_at')::timestamptz
)
ON CONFLICT (id) DO UPDATE
SET release_id = EXCLUDED.release_id,
    job_agent_id = EXCLUDED.job_agent_id,
    workflow_job_id = EXCLUDED.workflow_job_id,
    status = EXCLUDED.status,
    reason = EXCLUDED.reason,
    external_id = EXCLUDED.external_id,
    message = EXCLUDED.message,
    trace_token = EXCLUDED.trace_token,
    job_agent_config = EXCLUDED.job_agent_config,
    dispatch_context = EXCLUDED.dispatch_context,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at
RETURNING *;

-- name: DeleteJob :exec
DELETE FROM job WHERE id = $1;
