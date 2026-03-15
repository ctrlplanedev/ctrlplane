-- name: GetDeploymentPlan :one
SELECT
  dp.id,
  dp.workspace_id,
  dp.deployment_id,
  dp.version_tag,
  dp.version_name,
  dp.version_config,
  dp.version_job_agent_config,
  dp.version_metadata,
  dp.metadata,
  dp.created_at,
  dp.completed_at,
  dp.expires_at
FROM deployment_plan dp
WHERE dp.id = $1;

-- name: InsertDeploymentPlanTarget :one
INSERT INTO deployment_plan_target (id, plan_id, environment_id, resource_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (plan_id, environment_id, resource_id) DO NOTHING
RETURNING id;

-- name: InsertDeploymentPlanTargetResult :exec
INSERT INTO deployment_plan_target_result (id, target_id, dispatch_context, status)
VALUES ($1, $2, $3, 'computing');

-- name: GetDeploymentPlanTargetResult :one
SELECT
  r.id,
  r.target_id,
  r.dispatch_context,
  r.agent_state,
  r.status,
  r.has_changes,
  r.content_hash,
  r.current,
  r.proposed,
  r.message,
  r.started_at,
  r.completed_at
FROM deployment_plan_target_result r
WHERE r.id = $1;

-- name: UpdateDeploymentPlanTargetResultState :exec
UPDATE deployment_plan_target_result
SET agent_state = $2
WHERE id = $1;

-- name: UpdateDeploymentPlanTargetResultCompleted :exec
UPDATE deployment_plan_target_result
SET status = $2,
    has_changes = $3,
    content_hash = $4,
    current = $5,
    proposed = $6,
    message = $7,
    completed_at = NOW()
WHERE id = $1;

-- name: UpdateDeploymentPlanCompleted :exec
UPDATE deployment_plan
SET completed_at = NOW()
WHERE id = $1;
