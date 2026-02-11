ALTER TYPE "public"."deployment_version_status" ADD VALUE 'unspecified' BEFORE 'building';--> statement-breakpoint
ALTER TABLE "deployment_variable" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployment_variable_set" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployment_variable_value_direct" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployment_variable_value_reference" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployment_version_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "environment_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hook" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runhook" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_resource_relationship" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_relationship" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_variable" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_view" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runbook" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runbook_job_trigger" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variable_set" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variable_set_environment" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variable_set_value" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_metadata_group" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runbook_variable" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "computed_policy_target_release_target" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_target" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "release" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "release_job" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "release_target" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "release_target_lock_record" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variable_set_release" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variable_set_release_value" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variable_value_snapshot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "version_release" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_deny_window" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_user_approval" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_user_approval_record" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_role_approval" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_role_approval_record" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_any_approval" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_any_approval_record" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_deployment_version_selector" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_concurrency" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_environment_version_rollout" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policy_rule_retry" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_relationship_rule" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_relationship_rule_metadata_match" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_relationship_rule_source_metadata_equals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_relationship_rule_target_metadata_equals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "deployment_variable" CASCADE;--> statement-breakpoint
DROP TABLE "deployment_variable_set" CASCADE;--> statement-breakpoint
DROP TABLE "deployment_variable_value" CASCADE;--> statement-breakpoint
DROP TABLE "deployment_variable_value_direct" CASCADE;--> statement-breakpoint
DROP TABLE "deployment_variable_value_reference" CASCADE;--> statement-breakpoint
DROP TABLE "deployment_version_metadata" CASCADE;--> statement-breakpoint
DROP TABLE "deployment_version_dependency" CASCADE;--> statement-breakpoint
DROP TABLE "environment_metadata" CASCADE;--> statement-breakpoint
DROP TABLE "hook" CASCADE;--> statement-breakpoint
DROP TABLE "runhook" CASCADE;--> statement-breakpoint
DROP TABLE "job_resource_relationship" CASCADE;--> statement-breakpoint
DROP TABLE "resource_metadata" CASCADE;--> statement-breakpoint
DROP TABLE "resource_relationship" CASCADE;--> statement-breakpoint
DROP TABLE "resource_variable" CASCADE;--> statement-breakpoint
DROP TABLE "resource_view" CASCADE;--> statement-breakpoint
DROP TABLE "runbook" CASCADE;--> statement-breakpoint
DROP TABLE "runbook_job_trigger" CASCADE;--> statement-breakpoint
DROP TABLE "variable_set" CASCADE;--> statement-breakpoint
DROP TABLE "variable_set_environment" CASCADE;--> statement-breakpoint
DROP TABLE "variable_set_value" CASCADE;--> statement-breakpoint
DROP TABLE "resource_metadata_group" CASCADE;--> statement-breakpoint
DROP TABLE "runbook_variable" CASCADE;--> statement-breakpoint
DROP TABLE "computed_policy_target_release_target" CASCADE;--> statement-breakpoint
DROP TABLE "policy" CASCADE;--> statement-breakpoint
DROP TABLE "policy_target" CASCADE;--> statement-breakpoint
DROP TABLE "release" CASCADE;--> statement-breakpoint
DROP TABLE "release_job" CASCADE;--> statement-breakpoint
DROP TABLE "release_target" CASCADE;--> statement-breakpoint
DROP TABLE "release_target_lock_record" CASCADE;--> statement-breakpoint
DROP TABLE "variable_set_release" CASCADE;--> statement-breakpoint
DROP TABLE "variable_set_release_value" CASCADE;--> statement-breakpoint
DROP TABLE "variable_value_snapshot" CASCADE;--> statement-breakpoint
DROP TABLE "version_release" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_deny_window" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_user_approval" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_user_approval_record" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_role_approval" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_role_approval_record" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_any_approval" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_any_approval_record" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_deployment_version_selector" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_concurrency" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_environment_version_rollout" CASCADE;--> statement-breakpoint
DROP TABLE "policy_rule_retry" CASCADE;--> statement-breakpoint
DROP TABLE "resource_relationship_rule" CASCADE;--> statement-breakpoint
DROP TABLE "resource_relationship_rule_metadata_match" CASCADE;--> statement-breakpoint
DROP TABLE "resource_relationship_rule_source_metadata_equals" CASCADE;--> statement-breakpoint
DROP TABLE "resource_relationship_rule_target_metadata_equals" CASCADE;--> statement-breakpoint
ALTER TABLE "deployment_version" DROP CONSTRAINT "deployment_version_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_version" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "environment" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource" ADD COLUMN "metadata" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "retry_count";--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "timeout";--> statement-breakpoint
ALTER TABLE "environment" DROP COLUMN "directory";--> statement-breakpoint
ALTER TABLE "resource" DROP COLUMN "locked_at";--> statement-breakpoint
ALTER TABLE "public"."entity_role" ALTER COLUMN "scope_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."scope_type";--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('deploymentVersion', 'resource', 'resourceProvider', 'workspace', 'environment', 'system', 'deployment');--> statement-breakpoint
ALTER TABLE "public"."entity_role" ALTER COLUMN "scope_type" SET DATA TYPE "public"."scope_type" USING "scope_type"::"public"."scope_type";--> statement-breakpoint
DROP TYPE "public"."resource_relationship_type";--> statement-breakpoint
DROP TYPE "public"."approval_status";--> statement-breakpoint
DROP TYPE "public"."rollout_type";