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

-- name: GetReleaseTargetsForDeployment :many
-- Returns all valid release targets for a deployment by joining computed
-- resource tables through the system link tables.
SELECT DISTINCT
    cdr.deployment_id,
    cer.environment_id,
    cdr.resource_id
FROM computed_deployment_resource cdr
JOIN computed_environment_resource cer
    ON cer.resource_id = cdr.resource_id
JOIN system_deployment sd
    ON sd.deployment_id = cdr.deployment_id
JOIN system_environment se
    ON se.environment_id = cer.environment_id
    AND se.system_id = sd.system_id
WHERE cdr.deployment_id = @deployment_id;

-- name: ReleaseTargetExists :one
-- Checks whether a specific (deployment, environment, resource) triple forms
-- a valid release target via the computed resource and system link tables.
SELECT EXISTS (
    SELECT 1
    FROM computed_deployment_resource cdr
    JOIN computed_environment_resource cer
        ON cer.resource_id = cdr.resource_id
    JOIN system_deployment sd
        ON sd.deployment_id = cdr.deployment_id
    JOIN system_environment se
        ON se.environment_id = cer.environment_id
        AND se.system_id = sd.system_id
    WHERE cdr.deployment_id = @deployment_id
      AND cer.environment_id = @environment_id
      AND cdr.resource_id = @resource_id
) AS exists;

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
