ALTER TABLE "environment_policy_deployment" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "environment_policy" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "environment_policy_approval" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "environment_policy_release_window" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "environment_policy_deployment" CASCADE;--> statement-breakpoint
DROP TABLE "environment_policy" CASCADE;--> statement-breakpoint
DROP TABLE "environment_policy_approval" CASCADE;--> statement-breakpoint
DROP TABLE "environment_policy_release_window" CASCADE;--> statement-breakpoint
ALTER TABLE "environment" DROP CONSTRAINT IF EXISTS "environment_policy_id_environment_policy_id_fk";
--> statement-breakpoint
ALTER TABLE "environment" DROP COLUMN "policy_id";--> statement-breakpoint
ALTER TABLE "public"."entity_role" ALTER COLUMN "scope_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."scope_type";--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('deploymentVersion', 'resource', 'resourceProvider', 'resourceMetadataGroup', 'resourceRelationshipRule', 'workspace', 'environment', 'deploymentVariable', 'deploymentVariableValue', 'variableSet', 'system', 'deployment', 'job', 'jobAgent', 'runbook', 'policy', 'resourceView', 'releaseTarget');--> statement-breakpoint
ALTER TABLE "public"."entity_role" ALTER COLUMN "scope_type" SET DATA TYPE "public"."scope_type" USING "scope_type"::"public"."scope_type";--> statement-breakpoint
DROP TYPE "public"."environment_policy_approval_requirement";--> statement-breakpoint
DROP TYPE "public"."approval_status_type";--> statement-breakpoint
DROP TYPE "public"."environment_policy_deployment_success_type";--> statement-breakpoint
DROP TYPE "public"."recurrence_type";--> statement-breakpoint
DROP TYPE "public"."release_sequencing_type";