-- name: BatchUpsertPolicyRuleEvaluation :batchexec
INSERT INTO policy_rule_evaluation (
    rule_type, rule_id, environment_id, version_id, resource_id,
    allowed, action_required, action_type, message, details,
    satisfied_at, next_evaluation_at, evaluated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
ON CONFLICT (rule_id, environment_id, version_id, resource_id) DO UPDATE
SET rule_type          = EXCLUDED.rule_type,
    allowed            = EXCLUDED.allowed,
    action_required    = EXCLUDED.action_required,
    action_type        = EXCLUDED.action_type,
    message            = EXCLUDED.message,
    details            = EXCLUDED.details,
    satisfied_at       = EXCLUDED.satisfied_at,
    next_evaluation_at = EXCLUDED.next_evaluation_at,
    evaluated_at       = EXCLUDED.evaluated_at;

-- name: DeleteStalePolicyRuleEvaluations :exec
DELETE FROM policy_rule_evaluation
WHERE environment_id = @environment_id
  AND version_id = @version_id
  AND resource_id = @resource_id
  AND rule_type = ANY(@rule_types::text[])
  AND rule_id != ALL(@keep_rule_ids::uuid[]);
