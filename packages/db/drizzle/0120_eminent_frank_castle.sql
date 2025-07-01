DROP TABLE "deployment_version_channel" CASCADE;--> statement-breakpoint
DROP TABLE "environment_policy_deployment_version_channel" CASCADE;--> statement-breakpoint
ALTER TABLE "public"."entity_role" ALTER COLUMN "scope_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."scope_type";--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('deploymentVersion', 'resource', 'resourceProvider', 'resourceMetadataGroup', 'resourceRelationshipRule', 'workspace', 'environment', 'environmentPolicy', 'deploymentVariable', 'deploymentVariableValue', 'variableSet', 'system', 'deployment', 'job', 'jobAgent', 'runbook', 'policy', 'resourceView', 'releaseTarget');--> statement-breakpoint
ALTER TABLE "public"."entity_role" ALTER COLUMN "scope_type" SET DATA TYPE "public"."scope_type" USING "scope_type"::"public"."scope_type";