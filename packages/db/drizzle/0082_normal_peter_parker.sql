ALTER TYPE "scope_type" ADD VALUE 'policy';--> statement-breakpoint
ALTER TABLE "policy_rule_deny_window" ADD COLUMN "dtend" timestamp DEFAULT NULL;