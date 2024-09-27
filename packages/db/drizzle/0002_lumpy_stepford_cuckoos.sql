ALTER TYPE "scope_type" ADD VALUE 'deploymentVariable';--> statement-breakpoint
DROP TABLE "deployment_variable_value_target";--> statement-breakpoint
DROP TABLE "deployment_variable_value_target_filter";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "target_filter" jsonb DEFAULT NULL;