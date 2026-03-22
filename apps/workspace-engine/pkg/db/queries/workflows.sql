-- name: GetWorkflowByID :one
SELECT * FROM workflow WHERE id = $1;

-- name: InsertWorkflowRun :one
INSERT INTO workflow_run (workflow_id, inputs) VALUES ($1, $2)
RETURNING *;

-- name: InsertWorkflowJob :one
INSERT INTO workflow_job (workflow_run_id, job_id) VALUES ($1, $2)
RETURNING *;

-- name: GetWorkflowJobByJobID :one
SELECT * FROM workflow_job WHERE job_id = $1;
