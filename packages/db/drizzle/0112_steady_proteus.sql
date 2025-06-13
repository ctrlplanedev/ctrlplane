CREATE TYPE "public"."rollout_type" AS ENUM('linear', 'linear_normalized', 'exponential', 'exponential_normalized');--> statement-breakpoint
CREATE TABLE "policy_rule_environment_version_rollout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"position_growth_factor" real DEFAULT 1 NOT NULL,
	"time_scale_interval" real NOT NULL,
	"rollout_type" "rollout_type" DEFAULT 'linear' NOT NULL,
	CONSTRAINT "policy_rule_environment_version_rollout_policy_id_unique" UNIQUE("policy_id")
);
--> statement-breakpoint
ALTER TABLE "policy_rule_environment_version_rollout" ADD CONSTRAINT "policy_rule_environment_version_rollout_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;