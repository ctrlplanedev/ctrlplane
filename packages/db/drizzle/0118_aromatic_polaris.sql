CREATE TABLE "policy_rule_retry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"max_retries" integer NOT NULL,
	CONSTRAINT "policy_rule_retry_policy_id_unique" UNIQUE("policy_id")
);
--> statement-breakpoint
ALTER TABLE "policy_rule_retry" ADD CONSTRAINT "policy_rule_retry_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;