CREATE TYPE "public"."release_job_trigger_type" AS ENUM('new_version', 'version_updated', 'new_resource', 'resource_changed', 'api', 'redeploy', 'force_deploy', 'new_environment', 'variable_changed', 'retry');--> statement-breakpoint
CREATE TABLE "release_job_trigger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"type" "release_job_trigger_type" NOT NULL,
	"caused_by_id" uuid,
	"deployment_version_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "release_job_trigger_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "resource_deployment_relationship_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text,
	"reference" text NOT NULL,
	"relationship_type" "resource_deployment_relationship_type" NOT NULL,
	"relationship_description" text,
	"description" text,
	"resource_kind" text NOT NULL,
	"resource_version" text NOT NULL,
	"deployment_slug" text,
	"deployment_system_id" uuid
);
--> statement-breakpoint
CREATE TABLE "resource_deployment_rule_metadata_equals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_deployment_rule_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_deployment_rule_metadata_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_deployment_rule_id" uuid NOT NULL,
	"key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_caused_by_id_user_id_fk" FOREIGN KEY ("caused_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_deployment_relationship_rule" ADD CONSTRAINT "resource_deployment_relationship_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_deployment_rule_metadata_equals" ADD CONSTRAINT "resource_deployment_rule_metadata_equals_resource_deployment_rule_id_resource_deployment_relationship_rule_id_fk" FOREIGN KEY ("resource_deployment_rule_id") REFERENCES "public"."resource_deployment_relationship_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_deployment_rule_metadata_match" ADD CONSTRAINT "resource_deployment_rule_metadata_match_resource_deployment_rule_id_resource_deployment_relationship_rule_id_fk" FOREIGN KEY ("resource_deployment_rule_id") REFERENCES "public"."resource_deployment_relationship_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_deployment_relationship_rule_workspace_id_reference_resource_kind_resource_version_index" ON "resource_deployment_relationship_rule" USING btree ("workspace_id","reference","resource_kind","resource_version");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_deployment_rule_metadata_equals_resource_deployment_rule_id_key_index" ON "resource_deployment_rule_metadata_equals" USING btree ("resource_deployment_rule_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_resource_deployment_rule_metadata_match" ON "resource_deployment_rule_metadata_match" USING btree ("resource_deployment_rule_id","key");