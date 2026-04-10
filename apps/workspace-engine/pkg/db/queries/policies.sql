-- name: GetPolicyByID :one
SELECT id, name, description, selector, metadata, priority, enabled, workspace_id, created_at
FROM policy
WHERE id = $1;

-- name: ListPoliciesByWorkspaceID :many
SELECT id, name, description, selector, metadata, priority, enabled, workspace_id, created_at
FROM policy
WHERE workspace_id = $1
ORDER BY priority DESC, created_at DESC
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: UpsertPolicy :one
INSERT INTO policy (id, name, description, selector, metadata, priority, enabled, workspace_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    selector = EXCLUDED.selector, metadata = EXCLUDED.metadata,
    priority = EXCLUDED.priority, enabled = EXCLUDED.enabled,
    workspace_id = EXCLUDED.workspace_id,
    created_at = CASE WHEN sqlc.narg('created_at')::timestamptz IS NOT NULL THEN EXCLUDED.created_at ELSE policy.created_at END
RETURNING *;

-- name: DeletePolicy :exec
DELETE FROM policy WHERE id = $1;

-- name: ListPoliciesWithRulesByWorkspaceID :many
SELECT
  p.id, p.name, p.description, p.selector, p.metadata, p.priority, p.enabled, p.workspace_id, p.created_at,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'minApprovals', r.min_approvals)) FROM policy_rule_any_approval r WHERE r.policy_id = p.id), '[]'::json) AS approval_rules,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'allowWindow', r.allow_window, 'durationMinutes', r.duration_minutes, 'rrule', r.rrule, 'timezone', r.timezone)) FROM policy_rule_deployment_window r WHERE r.policy_id = p.id), '[]'::json) AS deployment_window_rules,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'dependsOn', r.depends_on)) FROM policy_rule_deployment_dependency r WHERE r.policy_id = p.id), '[]'::json) AS deployment_dependency_rules,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'dependsOnEnvironmentSelector', r.depends_on_environment_selector, 'maximumAgeHours', r.maximum_age_hours, 'minimumSoakTimeMinutes', r.minimum_soak_time_minutes, 'minimumSuccessPercentage', r.minimum_success_percentage, 'successStatuses', r.success_statuses, 'requireVerificationPassed', r.require_verification_passed)) FROM policy_rule_environment_progression r WHERE r.policy_id = p.id), '[]'::json) AS environment_progression_rules,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'rolloutType', r.rollout_type, 'timeScaleInterval', r.time_scale_interval)) FROM policy_rule_gradual_rollout r WHERE r.policy_id = p.id), '[]'::json) AS gradual_rollout_rules,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'intervalSeconds', r.interval_seconds)) FROM policy_rule_version_cooldown r WHERE r.policy_id = p.id), '[]'::json) AS version_cooldown_rules,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'description', r.description, 'selector', r.selector)) FROM policy_rule_version_selector r WHERE r.policy_id = p.id), '[]'::json) AS version_selector_rules
FROM policy p
WHERE p.workspace_id = $1
ORDER BY p.priority DESC, p.created_at DESC;

-- ============================================================
-- policy_rule_any_approval
-- ============================================================

-- name: ListAnyApprovalRulesByPolicyID :many
SELECT id, policy_id, min_approvals, created_at
FROM policy_rule_any_approval
WHERE policy_id = $1;

-- name: UpsertAnyApprovalRule :exec
INSERT INTO policy_rule_any_approval (id, policy_id, min_approvals, created_at)
VALUES ($1, $2, $3, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET min_approvals = EXCLUDED.min_approvals;

-- name: DeleteAnyApprovalRulesByPolicyID :exec
DELETE FROM policy_rule_any_approval WHERE policy_id = $1;

-- ============================================================
-- policy_rule_deployment_dependency
-- ============================================================

-- name: ListDeploymentDependencyRulesByPolicyID :many
SELECT id, policy_id, depends_on, created_at
FROM policy_rule_deployment_dependency
WHERE policy_id = $1;

-- name: UpsertDeploymentDependencyRule :exec
INSERT INTO policy_rule_deployment_dependency (id, policy_id, depends_on, created_at)
VALUES ($1, $2, $3, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET depends_on = EXCLUDED.depends_on;

-- name: DeleteDeploymentDependencyRulesByPolicyID :exec
DELETE FROM policy_rule_deployment_dependency WHERE policy_id = $1;

-- ============================================================
-- policy_rule_deployment_window
-- ============================================================

-- name: ListDeploymentWindowRulesByPolicyID :many
SELECT id, policy_id, allow_window, duration_minutes, rrule, timezone, created_at
FROM policy_rule_deployment_window
WHERE policy_id = $1;

-- name: UpsertDeploymentWindowRule :exec
INSERT INTO policy_rule_deployment_window (id, policy_id, allow_window, duration_minutes, rrule, timezone, created_at)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET allow_window = EXCLUDED.allow_window, duration_minutes = EXCLUDED.duration_minutes,
    rrule = EXCLUDED.rrule, timezone = EXCLUDED.timezone;

-- name: DeleteDeploymentWindowRulesByPolicyID :exec
DELETE FROM policy_rule_deployment_window WHERE policy_id = $1;

-- ============================================================
-- policy_rule_environment_progression
-- ============================================================

-- name: ListEnvironmentProgressionRulesByPolicyID :many
SELECT id, policy_id, depends_on_environment_selector, maximum_age_hours,
       minimum_soak_time_minutes, minimum_success_percentage, success_statuses,
       require_verification_passed, created_at
FROM policy_rule_environment_progression
WHERE policy_id = $1;

-- name: UpsertEnvironmentProgressionRule :exec
INSERT INTO policy_rule_environment_progression (
    id, policy_id, depends_on_environment_selector, maximum_age_hours,
    minimum_soak_time_minutes, minimum_success_percentage, success_statuses,
    require_verification_passed, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET depends_on_environment_selector = EXCLUDED.depends_on_environment_selector,
    maximum_age_hours = EXCLUDED.maximum_age_hours,
    minimum_soak_time_minutes = EXCLUDED.minimum_soak_time_minutes,
    minimum_success_percentage = EXCLUDED.minimum_success_percentage,
    success_statuses = EXCLUDED.success_statuses,
    require_verification_passed = EXCLUDED.require_verification_passed;

-- name: DeleteEnvironmentProgressionRulesByPolicyID :exec
DELETE FROM policy_rule_environment_progression WHERE policy_id = $1;

-- ============================================================
-- policy_rule_gradual_rollout
-- ============================================================

-- name: ListGradualRolloutRulesByPolicyID :many
SELECT id, policy_id, rollout_type, time_scale_interval, created_at
FROM policy_rule_gradual_rollout
WHERE policy_id = $1;

-- name: UpsertGradualRolloutRule :exec
INSERT INTO policy_rule_gradual_rollout (id, policy_id, rollout_type, time_scale_interval, created_at)
VALUES ($1, $2, $3, $4, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET rollout_type = EXCLUDED.rollout_type, time_scale_interval = EXCLUDED.time_scale_interval;

-- name: DeleteGradualRolloutRulesByPolicyID :exec
DELETE FROM policy_rule_gradual_rollout WHERE policy_id = $1;

-- ============================================================
-- policy_rule_retry
-- ============================================================

-- name: ListRetryRulesByPolicyID :many
SELECT id, policy_id, max_retries, backoff_seconds, backoff_strategy,
       max_backoff_seconds, retry_on_statuses, created_at
FROM policy_rule_retry
WHERE policy_id = $1;

-- name: UpsertRetryRule :exec
INSERT INTO policy_rule_retry (
    id, policy_id, max_retries, backoff_seconds, backoff_strategy,
    max_backoff_seconds, retry_on_statuses, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET max_retries = EXCLUDED.max_retries, backoff_seconds = EXCLUDED.backoff_seconds,
    backoff_strategy = EXCLUDED.backoff_strategy, max_backoff_seconds = EXCLUDED.max_backoff_seconds,
    retry_on_statuses = EXCLUDED.retry_on_statuses;

-- name: DeleteRetryRulesByPolicyID :exec
DELETE FROM policy_rule_retry WHERE policy_id = $1;

-- ============================================================
-- policy_rule_rollback
-- ============================================================

-- name: ListRollbackRulesByPolicyID :many
SELECT id, policy_id, on_job_statuses, on_verification_failure, created_at
FROM policy_rule_rollback
WHERE policy_id = $1;

-- name: UpsertRollbackRule :exec
INSERT INTO policy_rule_rollback (id, policy_id, on_job_statuses, on_verification_failure, created_at)
VALUES ($1, $2, $3, $4, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET on_job_statuses = EXCLUDED.on_job_statuses, on_verification_failure = EXCLUDED.on_verification_failure;

-- name: DeleteRollbackRulesByPolicyID :exec
DELETE FROM policy_rule_rollback WHERE policy_id = $1;

-- ============================================================
-- policy_rule_verification
-- ============================================================

-- name: ListVerificationRulesByPolicyID :many
SELECT id, policy_id, metrics, trigger_on, created_at
FROM policy_rule_verification
WHERE policy_id = $1;

-- name: UpsertVerificationRule :exec
INSERT INTO policy_rule_verification (id, policy_id, metrics, trigger_on, created_at)
VALUES ($1, $2, $3, $4, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET metrics = EXCLUDED.metrics, trigger_on = EXCLUDED.trigger_on;

-- name: DeleteVerificationRulesByPolicyID :exec
DELETE FROM policy_rule_verification WHERE policy_id = $1;

-- ============================================================
-- policy_rule_version_cooldown
-- ============================================================

-- name: ListVersionCooldownRulesByPolicyID :many
SELECT id, policy_id, interval_seconds, created_at
FROM policy_rule_version_cooldown
WHERE policy_id = $1;

-- name: UpsertVersionCooldownRule :exec
INSERT INTO policy_rule_version_cooldown (id, policy_id, interval_seconds, created_at)
VALUES ($1, $2, $3, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET interval_seconds = EXCLUDED.interval_seconds;

-- name: DeleteVersionCooldownRulesByPolicyID :exec
DELETE FROM policy_rule_version_cooldown WHERE policy_id = $1;

-- ============================================================
-- policy_rule_version_selector
-- ============================================================

-- name: ListVersionSelectorRulesByPolicyID :many
SELECT id, policy_id, description, selector, created_at
FROM policy_rule_version_selector
WHERE policy_id = $1;

-- name: UpsertVersionSelectorRule :exec
INSERT INTO policy_rule_version_selector (id, policy_id, description, selector, created_at)
VALUES ($1, $2, $3, $4, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET description = EXCLUDED.description, selector = EXCLUDED.selector;

-- name: DeleteVersionSelectorRulesByPolicyID :exec
DELETE FROM policy_rule_version_selector WHERE policy_id = $1;

-- ============================================================
-- computed_policy_release_target
-- ============================================================

-- name: SetPoliciesForReleaseTarget :exec
WITH deleted AS (
    DELETE FROM computed_policy_release_target
    WHERE resource_id = @resource_id
      AND environment_id = @environment_id
      AND deployment_id = @deployment_id
)
INSERT INTO computed_policy_release_target (policy_id, environment_id, deployment_id, resource_id, computed_at)
SELECT DISTINCT unnest(@policy_ids::uuid[]), @environment_id, @deployment_id, @resource_id, NOW()
ON CONFLICT (policy_id, environment_id, deployment_id, resource_id) DO UPDATE SET computed_at = NOW();
