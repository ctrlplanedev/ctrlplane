-- name: UpsertPolicyRuleSummary :batchexec
INSERT INTO policy_rule_summary (
    id, rule_id,
    deployment_id, environment_id, version_id,
    allowed, action_required, action_type,
    message, details,
    satisfied_at, next_evaluation_at, evaluated_at
)
VALUES (
    gen_random_uuid(), $1,
    $2, $3, $4,
    $5, $6, $7,
    $8, $9,
    $10, $11, NOW()
)
ON CONFLICT (rule_id, deployment_id, environment_id, version_id) DO UPDATE
SET allowed = EXCLUDED.allowed,
    action_required = EXCLUDED.action_required,
    action_type = EXCLUDED.action_type,
    message = EXCLUDED.message,
    details = EXCLUDED.details,
    satisfied_at = EXCLUDED.satisfied_at,
    next_evaluation_at = EXCLUDED.next_evaluation_at,
    evaluated_at = NOW();

-- name: ListPolicyRuleSummariesByDeploymentAndVersion :many
SELECT id, rule_id,
       deployment_id, environment_id, version_id,
       allowed, action_required, action_type,
       message, details,
       satisfied_at, next_evaluation_at, evaluated_at
FROM policy_rule_summary
WHERE deployment_id = $1 AND version_id = $2;

-- name: ListPolicyRuleSummariesByEnvironment :many
SELECT id, rule_id,
       deployment_id, environment_id, version_id,
       allowed, action_required, action_type,
       message, details,
       satisfied_at, next_evaluation_at, evaluated_at
FROM policy_rule_summary
WHERE environment_id = $1;

-- name: ListPolicyRuleSummariesByEnvironmentAndVersion :many
SELECT id, rule_id,
       deployment_id, environment_id, version_id,
       allowed, action_required, action_type,
       message, details,
       satisfied_at, next_evaluation_at, evaluated_at
FROM policy_rule_summary
WHERE environment_id = $1 AND version_id = $2;

-- name: DeletePolicyRuleSummariesByRuleID :exec
DELETE FROM policy_rule_summary WHERE rule_id = $1;
