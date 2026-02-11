-- name: UpsertChangelogEntry :batchexec
INSERT INTO changelog_entry (workspace_id, entity_type, entity_id, entity_data, created_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (workspace_id, entity_type, entity_id)
DO UPDATE SET entity_data = EXCLUDED.entity_data;

-- name: DeleteChangelogEntry :batchexec
DELETE FROM changelog_entry
WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3;

-- name: ListChangelogEntriesByWorkspace :many
SELECT entity_type, entity_id, entity_data, created_at
FROM changelog_entry
WHERE workspace_id = $1
ORDER BY created_at ASC;
