ALTER TABLE "github_entity" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "github_user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_provider_github_repo" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "azure_tenant" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_provider_aws" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_provider_azure" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_provider_google" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_snapshot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "github_entity" CASCADE;--> statement-breakpoint
DROP TABLE "github_user" CASCADE;--> statement-breakpoint
DROP TABLE "resource_provider_github_repo" CASCADE;--> statement-breakpoint
DROP TABLE "azure_tenant" CASCADE;--> statement-breakpoint
DROP TABLE "resource_provider_aws" CASCADE;--> statement-breakpoint
DROP TABLE "resource_provider_azure" CASCADE;--> statement-breakpoint
DROP TABLE "resource_provider_google" CASCADE;--> statement-breakpoint
DROP TABLE "workspace_snapshot" CASCADE;--> statement-breakpoint
ALTER TABLE "deployment" DROP CONSTRAINT "deployment_system_id_system_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment" DROP CONSTRAINT "deployment_job_agent_id_job_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "environment" DROP CONSTRAINT "environment_system_id_system_id_fk";
--> statement-breakpoint
DROP INDEX "deployment_system_id_slug_index";--> statement-breakpoint
DROP INDEX "environment_system_id_name_index";--> statement-breakpoint
ALTER TABLE "deployment" ALTER COLUMN "resource_selector" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "deployment" ALTER COLUMN "resource_selector" SET DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "environment" ALTER COLUMN "resource_selector" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "environment" ALTER COLUMN "resource_selector" SET DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "resource_provider" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_provider" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "system_id";--> statement-breakpoint
ALTER TABLE "environment" DROP COLUMN "system_id";--> statement-breakpoint
ALTER TABLE "workspace" DROP COLUMN "google_service_account_email";--> statement-breakpoint
ALTER TABLE "workspace" DROP COLUMN "aws_role_arn";--> statement-breakpoint
DROP TYPE "public"."github_entity_type";