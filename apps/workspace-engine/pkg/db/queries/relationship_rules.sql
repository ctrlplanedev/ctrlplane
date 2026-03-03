-- name: GetRelationshipRuleByID :one
SELECT id, name, description, workspace_id, from_type, to_type, relationship_type, reference, from_selector, to_selector, matcher, metadata
FROM relationship_rule
WHERE id = $1;

-- name: ListRelationshipRulesByWorkspaceID :many
SELECT id, name, description, workspace_id, from_type, to_type, relationship_type, reference, from_selector, to_selector, matcher, metadata
FROM relationship_rule
WHERE workspace_id = $1;

-- name: UpsertRelationshipRule :exec
INSERT INTO relationship_rule (id, name, description, workspace_id, from_type, to_type, relationship_type, reference, from_selector, to_selector, matcher, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, workspace_id = EXCLUDED.workspace_id,
    from_type = EXCLUDED.from_type, to_type = EXCLUDED.to_type, relationship_type = EXCLUDED.relationship_type,
    reference = EXCLUDED.reference, from_selector = EXCLUDED.from_selector, to_selector = EXCLUDED.to_selector,
    matcher = EXCLUDED.matcher, metadata = EXCLUDED.metadata;

-- name: DeleteRelationshipRule :exec
DELETE FROM relationship_rule WHERE id = $1;
