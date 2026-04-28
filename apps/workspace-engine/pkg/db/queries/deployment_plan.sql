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

-- name: GetTargetContextByResultID :one
SELECT
  t.id AS target_id,
  t.plan_id,
  t.current_release_id,
  dp.deployment_id,
  dp.workspace_id,
  dp.version_tag,
  dp.version_metadata,
  w.slug AS workspace_slug,
  e.name AS environment_name,
  res.name AS resource_name
FROM deployment_plan_target_result r
JOIN deployment_plan_target t ON t.id = r.target_id
JOIN deployment_plan dp ON dp.id = t.plan_id
JOIN workspace w ON w.id = dp.workspace_id
JOIN environment e ON e.id = t.environment_id
JOIN resource res ON res.id = t.resource_id
WHERE r.id = $1;

-- name: ListDeploymentPlanTargetResultsByTargetID :many
SELECT
  r.id,
  r.target_id,
  r.dispatch_context,
  r.status,
  r.has_changes,
  r.current,
  r.proposed,
  r.message,
  r.started_at,
  r.completed_at
FROM deployment_plan_target_result r
WHERE r.target_id = $1
ORDER BY r.started_at;

-- ============================================================
-- deployment_plan_target_result_validation
-- ============================================================

-- name: UpsertPlanTargetResultValidation :exec
INSERT INTO deployment_plan_target_result_validation (result_id, rule_id, passed, violations, evaluated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (result_id, rule_id) DO UPDATE
SET passed = EXCLUDED.passed,
    violations = EXCLUDED.violations,
    evaluated_at = EXCLUDED.evaluated_at;

-- name: ListPlanTargetResultValidationsByResultID :many
SELECT
  v.id,
  v.result_id,
  v.rule_id,
  v.passed,
  v.violations,
  v.evaluated_at
FROM deployment_plan_target_result_validation v
WHERE v.result_id = $1
ORDER BY v.evaluated_at;

-- name: ListPlanTargetResultValidationsByTargetID :many
SELECT
  v.id,
  v.result_id,
  v.rule_id,
  v.passed,
  v.violations,
  v.evaluated_at
FROM deployment_plan_target_result_validation v
JOIN deployment_plan_target_result r ON r.id = v.result_id
WHERE r.target_id = $1
ORDER BY v.evaluated_at;

-- ============================================================
-- policy_rule_plan_validation
-- ============================================================

-- name: ListPlanValidationRulesByPolicyID :many
SELECT id, policy_id, name, description, rego, severity, created_at
FROM policy_rule_plan_validation
WHERE policy_id = $1;

-- name: UpsertPlanValidationRule :exec
INSERT INTO policy_rule_plan_validation (id, policy_id, name, description, rego, severity, created_at)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    rego = EXCLUDED.rego, severity = EXCLUDED.severity;

-- name: DeletePlanValidationRulesByPolicyID :exec
DELETE FROM policy_rule_plan_validation WHERE policy_id = $1;

-- name: GetLatestPlanValidationsForTarget :many
SELECT
  v.id,
  v.result_id,
  v.rule_id,
  v.passed,
  v.violations,
  v.evaluated_at,
  r.name AS rule_name,
  r.severity
FROM deployment_plan_target_result_validation v
JOIN policy_rule_plan_validation r ON r.id = v.rule_id
JOIN deployment_plan_target_result res ON res.id = v.result_id
JOIN deployment_plan_target t ON t.id = res.target_id
JOIN deployment_plan dp ON dp.id = t.plan_id
WHERE t.environment_id = $1
  AND t.resource_id = $2
  AND dp.deployment_id = $3
ORDER BY v.evaluated_at DESC;

-- name: GetVersionByReleaseID :one
SELECT
  dv.id,
  dv.tag,
  dv.name,
  dv.metadata,
  dv.config,
  dv.created_at,
  dv.status
FROM deployment_version dv
JOIN release r ON r.version_id = dv.id
WHERE r.id = $1;

-- name: ListPlanValidationRulesByWorkspaceID :many
SELECT r.id, r.policy_id, r.name, r.description, r.rego, r.severity, r.created_at,
       p.selector AS policy_selector
FROM policy_rule_plan_validation r
JOIN policy p ON p.id = r.policy_id
WHERE p.workspace_id = $1 AND p.enabled = true;
