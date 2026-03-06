-- name: GetRelationshipRuleByID :one
SELECT id, name, description, workspace_id, reference, cel, metadata
FROM relationship_rule
WHERE id = $1;

-- name: ListRelationshipRulesByWorkspaceID :many
SELECT id, name, description, workspace_id, reference, cel, metadata
FROM relationship_rule
WHERE workspace_id = $1;

-- name: UpsertRelationshipRule :one
INSERT INTO relationship_rule (id, name, description, workspace_id, reference, cel, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    workspace_id = EXCLUDED.workspace_id, reference = EXCLUDED.reference,
    cel = EXCLUDED.cel, metadata = EXCLUDED.metadata
RETURNING *;

-- name: DeleteRelationshipRule :exec
DELETE FROM relationship_rule WHERE id = $1;
