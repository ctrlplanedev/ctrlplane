CREATE TYPE "public"."deployment_plan_target_status" AS ENUM('computing', 'completed', 'errored', 'unsupported');--> statement-breakpoint
CREATE TABLE "deployment_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"version_tag" text NOT NULL,
	"version_name" text NOT NULL,
	"version_config" jsonb DEFAULT '{}' NOT NULL,
	"version_job_agent_config" jsonb DEFAULT '{}' NOT NULL,
	"version_metadata" jsonb DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_plan_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"current_release_id" uuid,
	"status" "deployment_plan_target_status" DEFAULT 'computing' NOT NULL,
	"has_changes" boolean,
	"content_hash" text,
	"current" text,
	"proposed" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deployment_plan_target_variable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_plan" ADD CONSTRAINT "deployment_plan_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_plan" ADD CONSTRAINT "deployment_plan_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_plan_target" ADD CONSTRAINT "deployment_plan_target_plan_id_deployment_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."deployment_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_plan_target" ADD CONSTRAINT "deployment_plan_target_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_plan_target" ADD CONSTRAINT "deployment_plan_target_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_plan_target" ADD CONSTRAINT "deployment_plan_target_current_release_id_release_id_fk" FOREIGN KEY ("current_release_id") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_plan_target_variable" ADD CONSTRAINT "deployment_plan_target_variable_target_id_deployment_plan_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."deployment_plan_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deployment_plan_workspace_id_index" ON "deployment_plan" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "deployment_plan_deployment_id_index" ON "deployment_plan" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "deployment_plan_expires_at_index" ON "deployment_plan" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "deployment_plan_target_plan_id_index" ON "deployment_plan_target" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "deployment_plan_target_environment_id_index" ON "deployment_plan_target" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "deployment_plan_target_resource_id_index" ON "deployment_plan_target" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_plan_target_variable_target_id_key_index" ON "deployment_plan_target_variable" USING btree ("target_id","key");