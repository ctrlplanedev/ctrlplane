-- name: GetWorkflowByID :one
SELECT id, name, inputs, jobs, workspace_id FROM workflow WHERE id = $1;

-- name: ListWorkflowsByWorkspaceID :many
SELECT id, name, inputs, jobs, workspace_id FROM workflow WHERE workspace_id = $1;

-- name: UpsertWorkflow :one
INSERT INTO workflow (id, name, inputs, jobs, workspace_id) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, inputs = EXCLUDED.inputs, jobs = EXCLUDED.jobs, workspace_id = EXCLUDED.workspace_id
RETURNING *;

-- name: DeleteWorkflow :exec
DELETE FROM workflow WHERE id = $1;

-- name: GetWorkflowJobTemplateByID :one
SELECT id, workflow_id, name, ref, config, if_condition, matrix FROM workflow_job_template WHERE id = $1;

-- name: ListWorkflowJobTemplatesByWorkspaceID :many
SELECT wjt.id, wjt.workflow_id, wjt.name, wjt.ref, wjt.config, wjt.if_condition, wjt.matrix
FROM workflow_job_template wjt
INNER JOIN workflow w ON w.id = wjt.workflow_id
WHERE w.workspace_id = $1;

-- name: UpsertWorkflowJobTemplate :one
INSERT INTO workflow_job_template (id, workflow_id, name, ref, config, if_condition, matrix) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id) DO UPDATE SET workflow_id = EXCLUDED.workflow_id, name = EXCLUDED.name, ref = EXCLUDED.ref, config = EXCLUDED.config, if_condition = EXCLUDED.if_condition, matrix = EXCLUDED.matrix
RETURNING *;

-- name: DeleteWorkflowJobTemplate :exec
DELETE FROM workflow_job_template WHERE id = $1;

-- name: GetWorkflowRunByID :one
SELECT id, workflow_id, inputs FROM workflow_run WHERE id = $1;

-- name: ListWorkflowRunsByWorkflowID :many
SELECT id, workflow_id, inputs FROM workflow_run WHERE workflow_id = $1;

-- name: ListWorkflowRunsByWorkspaceID :many
SELECT wr.id, wr.workflow_id, wr.inputs
FROM workflow_run wr
INNER JOIN workflow w ON w.id = wr.workflow_id
WHERE w.workspace_id = $1;

-- name: UpsertWorkflowRun :one
INSERT INTO workflow_run (id, workflow_id, inputs) VALUES ($1, $2, $3)
ON CONFLICT (id) DO UPDATE SET workflow_id = EXCLUDED.workflow_id, inputs = EXCLUDED.inputs
RETURNING *;

-- name: DeleteWorkflowRun :exec
DELETE FROM workflow_run WHERE id = $1;

-- name: GetWorkflowJobByID :one
SELECT id, workflow_run_id, ref, config, index FROM workflow_job WHERE id = $1;

-- name: ListWorkflowJobsByWorkflowRunID :many
SELECT id, workflow_run_id, ref, config, index FROM workflow_job WHERE workflow_run_id = $1 ORDER BY index ASC;

-- name: ListWorkflowJobsByWorkspaceID :many
SELECT wj.id, wj.workflow_run_id, wj.ref, wj.config, wj.index
FROM workflow_job wj
INNER JOIN workflow_run wr ON wr.id = wj.workflow_run_id
INNER JOIN workflow w ON w.id = wr.workflow_id
WHERE w.workspace_id = $1
ORDER BY wj.index ASC;

-- name: UpsertWorkflowJob :one
INSERT INTO workflow_job (id, workflow_run_id, ref, config, index) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE SET workflow_run_id = EXCLUDED.workflow_run_id, ref = EXCLUDED.ref, config = EXCLUDED.config, index = EXCLUDED.index
RETURNING *;

-- name: DeleteWorkflowJob :exec
DELETE FROM workflow_job WHERE id = $1;
