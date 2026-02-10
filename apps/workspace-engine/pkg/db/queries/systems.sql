-- name: ListSystemsByWorkspaceID :many
SELECT
    s.id,
    s.workspace_id,
    s.name,
    s.description
FROM system s
WHERE s.workspace_id = $1;