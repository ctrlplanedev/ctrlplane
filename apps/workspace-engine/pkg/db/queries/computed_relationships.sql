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

-- name: SetComputedEntityRelationships :exec
-- Replaces computed relationships for an entity, only deleting stale rows.
-- Follows the same CTE pattern as SetComputedDeploymentResources.
WITH desired AS (
    SELECT
        unnest(@rule_ids::uuid[]) AS rule_id,
        unnest(@from_entity_types::text[]) AS from_entity_type,
        unnest(@from_entity_ids::uuid[]) AS from_entity_id,
        unnest(@to_entity_types::text[]) AS to_entity_type,
        unnest(@to_entity_ids::uuid[]) AS to_entity_id
),
deleted AS (
    DELETE FROM computed_entity_relationship cer
    WHERE ((cer.from_entity_type = @entity_type AND cer.from_entity_id = @entity_id)
        OR (cer.to_entity_type = @entity_type AND cer.to_entity_id = @entity_id))
      AND NOT EXISTS (
          SELECT 1 FROM desired d
          WHERE d.rule_id = cer.rule_id
            AND d.from_entity_type = cer.from_entity_type
            AND d.from_entity_id = cer.from_entity_id
            AND d.to_entity_type = cer.to_entity_type
            AND d.to_entity_id = cer.to_entity_id
      )
)
INSERT INTO computed_entity_relationship (
    rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, last_evaluated_at
)
SELECT rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, NOW()
FROM desired
ON CONFLICT (rule_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id) DO UPDATE
SET last_evaluated_at = NOW();

-- name: GetExistingRelationshipsForEntity :many
-- Returns all computed relationships where the given entity appears
-- as either the "from" or "to" side.
SELECT rule_id, from_entity_id, to_entity_id
FROM computed_entity_relationship
WHERE (from_entity_type = @entity_type AND from_entity_id = @entity_id)
   OR (to_entity_type = @entity_type AND to_entity_id = @entity_id);
