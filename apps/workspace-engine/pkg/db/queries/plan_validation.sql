-- name: ListPlanValidationOpaRulesForWorkspace :many
SELECT
  r.id,
  r.policy_id,
  r.name,
  r.description,
  r.rego,
  r.created_at,
  p.selector AS policy_selector
FROM policy_rule_plan_validation_opa r
JOIN policy p ON p.id = r.policy_id
WHERE p.workspace_id = $1
  AND p.enabled = true
ORDER BY p.priority DESC, r.created_at DESC;

-- name: GetCurrentVersionForPlanTarget :one
SELECT dv.*
FROM deployment_plan_target t
JOIN release rel ON rel.id = t.current_release_id
JOIN deployment_version dv ON dv.id = rel.version_id
WHERE t.id = $1;

-- name: UpsertPlanValidationResult :exec
INSERT INTO deployment_plan_target_result_validation (
  result_id, rule_id, passed, violations, evaluated_at
)
VALUES (
  sqlc.arg('result_id'),
  sqlc.arg('rule_id'),
  sqlc.arg('passed'),
  sqlc.arg('violations'),
  NOW()
)
ON CONFLICT (result_id, rule_id) DO UPDATE
SET passed = EXCLUDED.passed,
    violations = EXCLUDED.violations,
    evaluated_at = EXCLUDED.evaluated_at;
