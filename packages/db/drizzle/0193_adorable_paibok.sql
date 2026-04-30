CREATE TABLE "deployment_plan_target_result_validation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"passed" boolean NOT NULL,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_rule_plan_validation_opa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rego" text NOT NULL,
	"severity" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_plan_target_result_validation" ADD CONSTRAINT "deployment_plan_target_result_validation_result_id_deployment_plan_target_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."deployment_plan_target_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_plan_validation_opa" ADD CONSTRAINT "policy_rule_plan_validation_opa_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_plan_target_result_validation_result_id_rule_id_index" ON "deployment_plan_target_result_validation" USING btree ("result_id","rule_id");--> statement-breakpoint
CREATE INDEX "policy_rule_plan_validation_opa_policy_id_index" ON "policy_rule_plan_validation_opa" USING btree ("policy_id");