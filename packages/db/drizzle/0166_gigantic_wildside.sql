DELETE FROM "policy_rule_evaluation";--> statement-breakpoint
ALTER TABLE "policy_rule_evaluation" ADD COLUMN "rule_type" text NOT NULL;