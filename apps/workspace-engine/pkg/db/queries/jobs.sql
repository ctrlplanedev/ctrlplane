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
