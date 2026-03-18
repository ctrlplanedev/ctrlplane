-- name: GetRelationshipRulesForWorkspace :many
-- Returns all relationship rules for a workspace.
SELECT id, reference, cel
FROM relationship_rule
WHERE workspace_id = @workspace_id;

-- name: GetActiveResourceByID :one
SELECT id, workspace_id, name, kind, version, identifier,
       provider_id, config, metadata
FROM resource
WHERE id = @id AND deleted_at IS NULL;

-- name: GetDeploymentForRelEval :one
SELECT id, workspace_id, name, description, job_agent_id, job_agent_config, metadata
FROM deployment
WHERE id = @id;

-- name: GetEnvironmentForRelEval :one
SELECT id, workspace_id, name, description, metadata, created_at
FROM environment
WHERE id = @id;

-- name: ListActiveResourcesByWorkspace :many
SELECT id, workspace_id, name, kind, version, identifier,
       provider_id, config, metadata
FROM resource
WHERE workspace_id = @workspace_id AND deleted_at IS NULL;

-- name: ListDeploymentsByWorkspace :many
SELECT id, workspace_id, name, description, job_agent_id, job_agent_config, metadata
FROM deployment
WHERE workspace_id = @workspace_id;

-- name: ListEnvironmentsByWorkspace :many
SELECT id, workspace_id, name, description, metadata, created_at
FROM environment
WHERE workspace_id = @workspace_id;

-- name: BatchDeleteComputedEntityRelationshipByPK :batchexec
DELETE FROM computed_entity_relationship
WHERE rule_id = $1
  AND from_entity_type = $2
  AND from_entity_id = $3
  AND to_entity_type = $4
  AND to_entity_id = $5;

-- name: BatchUpsertComputedEntityRelationship :batchexec
INSERT INTO computed_entity_relationship (
    rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, last_evaluated_at
)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id) DO NOTHING;

-- name: GetExistingRelationshipsForEntity :many
-- Returns all computed relationships where the given entity appears
-- as either the "from" or "to" side. Uses UNION ALL instead of OR
-- so PostgreSQL can use separate index scans on each leg.
SELECT rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id
FROM computed_entity_relationship
WHERE from_entity_type = @entity_type AND from_entity_id = @entity_id
UNION ALL
SELECT rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id
FROM computed_entity_relationship
WHERE to_entity_type = @entity_type AND to_entity_id = @entity_id
  AND NOT (from_entity_type = @entity_type AND from_entity_id = @entity_id);
