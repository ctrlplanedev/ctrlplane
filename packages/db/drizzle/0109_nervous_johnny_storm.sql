CREATE TABLE "policy_rule_concurrency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"concurrency" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "policy_rule_concurrency_policy_id_unique" UNIQUE("policy_id")
);
--> statement-breakpoint
ALTER TABLE "policy_rule_concurrency" ADD CONSTRAINT "policy_rule_concurrency_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;