CREATE TABLE "policy_rule_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"deployment_id" uuid,
	"environment_id" uuid,
	"version_id" uuid,
	"allowed" boolean NOT NULL,
	"action_required" boolean DEFAULT false NOT NULL,
	"action_type" text,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"satisfied_at" timestamp with time zone,
	"next_evaluation_at" timestamp with time zone,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policy_rule_summary" ADD CONSTRAINT "policy_rule_summary_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_summary" ADD CONSTRAINT "policy_rule_summary_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_summary" ADD CONSTRAINT "policy_rule_summary_version_id_deployment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "policy_rule_summary_rule_id_deployment_id_environment_id_version_id_index" ON "policy_rule_summary" USING btree ("rule_id","deployment_id","environment_id","version_id");--> statement-breakpoint
CREATE INDEX "policy_rule_summary_deployment_id_version_id_index" ON "policy_rule_summary" USING btree ("deployment_id","version_id");--> statement-breakpoint
CREATE INDEX "policy_rule_summary_environment_id_index" ON "policy_rule_summary" USING btree ("environment_id");