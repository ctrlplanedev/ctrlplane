-- name: SetComputedDeploymentResources :exec
-- Replaces the full set of computed resources for a deployment.
-- Deletes stale rows and upserts the current set with last_evaluated_at = NOW().
WITH current AS (
    SELECT unnest(@resource_ids::uuid[]) AS resource_id
),
deleted AS (
    DELETE FROM computed_deployment_resource
    WHERE deployment_id = @deployment_id
      AND resource_id NOT IN (SELECT resource_id FROM current)
)
INSERT INTO computed_deployment_resource (deployment_id, resource_id, last_evaluated_at)
SELECT @deployment_id, resource_id, NOW()
FROM current
ON CONFLICT (deployment_id, resource_id) DO UPDATE
SET last_evaluated_at = NOW();

-- name: SetComputedEnvironmentResources :exec
-- Replaces the full set of computed resources for an environment.
-- Deletes stale rows and upserts the current set with last_evaluated_at = NOW().
WITH current AS (
    SELECT unnest(@resource_ids::uuid[]) AS resource_id
),
deleted AS (
    DELETE FROM computed_environment_resource
    WHERE environment_id = @environment_id
      AND resource_id NOT IN (SELECT resource_id FROM current)
)
INSERT INTO computed_environment_resource (environment_id, resource_id, last_evaluated_at)
SELECT @environment_id, resource_id, NOW()
FROM current
ON CONFLICT (environment_id, resource_id) DO UPDATE
SET last_evaluated_at = NOW();
