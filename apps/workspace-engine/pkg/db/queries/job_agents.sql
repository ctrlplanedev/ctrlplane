-- name: GetJobAgentByID :one
SELECT id, workspace_id, name, type, config FROM job_agent WHERE id = $1;

-- name: ListJobAgentsByWorkspaceID :many
SELECT id, workspace_id, name, type, config
FROM job_agent
WHERE workspace_id = $1;

-- name: UpsertJobAgent :one
INSERT INTO job_agent (id, workspace_id, name, type, config)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET workspace_id = EXCLUDED.workspace_id, name = EXCLUDED.name,
    type = EXCLUDED.type, config = EXCLUDED.config
RETURNING *;

-- name: DeleteJobAgent :exec
DELETE FROM job_agent WHERE id = $1;
