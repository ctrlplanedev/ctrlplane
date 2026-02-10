-- name: WorkspaceExists :one
SELECT EXISTS(SELECT 1 FROM workspace WHERE id = $1) AS exists;

-- name: ListWorkspaceIDs :many
SELECT id FROM workspace;