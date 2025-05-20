CREATE TABLE "policy_rule_gradual_rollout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deploy_rate" integer NOT NULL,
	"window_size_minutes" integer NOT NULL,
	CONSTRAINT "policy_rule_gradual_rollout_policy_id_unique" UNIQUE("policy_id")
);
--> statement-breakpoint
ALTER TABLE "policy_rule_gradual_rollout" ADD CONSTRAINT "policy_rule_gradual_rollout_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;