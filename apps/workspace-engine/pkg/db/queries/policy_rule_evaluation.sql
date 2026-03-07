-- name: BatchUpsertPolicyRuleEvaluation :batchexec
INSERT INTO policy_rule_evaluation (
    rule_id, environment_id, version_id, resource_id,
    allowed, action_required, action_type, message, details,
    satisfied_at, next_evaluation_at, evaluated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
ON CONFLICT (rule_id, environment_id, version_id, resource_id) DO UPDATE
SET allowed            = EXCLUDED.allowed,
    action_required    = EXCLUDED.action_required,
    action_type        = EXCLUDED.action_type,
    message            = EXCLUDED.message,
    details            = EXCLUDED.details,
    satisfied_at       = EXCLUDED.satisfied_at,
    next_evaluation_at = EXCLUDED.next_evaluation_at,
    evaluated_at       = EXCLUDED.evaluated_at;
