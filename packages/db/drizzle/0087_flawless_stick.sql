ALTER TABLE "policy_deployment_version_selector" RENAME TO "policy_rule_deployment_version_selector";--> statement-breakpoint
ALTER TABLE "policy_rule_deployment_version_selector" DROP CONSTRAINT "policy_deployment_version_selector_policy_id_unique";--> statement-breakpoint
ALTER TABLE "policy_rule_deployment_version_selector" DROP CONSTRAINT "policy_deployment_version_selector_policy_id_policy_id_fk";
--> statement-breakpoint
ALTER TABLE "policy_target" ADD COLUMN "resource_selector" jsonb DEFAULT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_rule_deployment_version_selector" ADD CONSTRAINT "policy_rule_deployment_version_selector_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "policy_rule_deployment_version_selector" ADD CONSTRAINT "policy_rule_deployment_version_selector_policy_id_unique" UNIQUE("policy_id");