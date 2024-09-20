import { pgTable, pgEnum } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const approvalStatusType = pgEnum("approval_status_type", ['pending', 'approved', 'rejected'])
export const concurrencyType = pgEnum("concurrency_type", ['all', 'some'])
export const entityType = pgEnum("entity_type", ['user', 'team'])
export const environmentPolicyApprovalRequirement = pgEnum("environment_policy_approval_requirement", ['manual', 'automatic'])
export const environmentPolicyDeploymentSuccessType = pgEnum("environment_policy_deployment_success_type", ['all', 'some', 'optional'])
export const evaluationType = pgEnum("evaluation_type", ['semver', 'regex', 'none'])
export const jobReason = pgEnum("job_reason", ['policy_passing', 'policy_override', 'env_policy_override', 'config_policy_override'])
export const jobStatus = pgEnum("job_status", ['completed', 'cancelled', 'skipped', 'in_progress', 'action_required', 'pending', 'failure', 'invalid_job_agent', 'invalid_integration', 'external_run_not_found'])
export const recurrenceType = pgEnum("recurrence_type", ['hourly', 'daily', 'weekly', 'monthly'])
export const releaseDependencyRuleType = pgEnum("release_dependency_rule_type", ['regex', 'semver'])
export const releaseJobTriggerType = pgEnum("release_job_trigger_type", ['new_release', 'new_target', 'target_changed', 'api', 'redeploy', 'force_deploy'])
export const releaseSequencingType = pgEnum("release_sequencing_type", ['wait', 'cancel'])
export const scopeType = pgEnum("scope_type", ['release', 'target', 'targetProvider', 'targetMetadataGroup', 'workspace', 'environment', 'environmentPolicy', 'variableSet', 'system', 'deployment', 'jobAgent', 'runbook'])



