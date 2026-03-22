-- name: GetWorkflowByID :one
SELECT * FROM workflow WHERE id = $1;
