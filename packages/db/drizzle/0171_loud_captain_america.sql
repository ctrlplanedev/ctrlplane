CREATE TABLE "deployment_plan_target_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"dispatch_context" jsonb NOT NULL,
	"agent_state" jsonb,
	"status" "deployment_plan_target_status" DEFAULT 'computing' NOT NULL,
	"has_changes" boolean,
	"content_hash" text,
	"current" text,
	"proposed" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "deployment_plan_target_environment_id_index";--> statement-breakpoint
DROP INDEX "deployment_plan_target_resource_id_index";--> statement-breakpoint
ALTER TABLE "deployment_plan_target_result" ADD CONSTRAINT "deployment_plan_target_result_target_id_deployment_plan_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."deployment_plan_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deployment_plan_target_result_target_id_index" ON "deployment_plan_target_result" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_plan_target_plan_id_environment_id_resource_id_index" ON "deployment_plan_target" USING btree ("plan_id","environment_id","resource_id");--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "has_changes";--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "content_hash";--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "current";--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "proposed";--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "started_at";--> statement-breakpoint
ALTER TABLE "deployment_plan_target" DROP COLUMN "completed_at";