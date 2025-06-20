DELETE FROM "policy_rule_any_approval_record";--> statement-breakpoint
DELETE FROM "policy_rule_role_approval_record";--> statement-breakpoint
DELETE FROM "policy_rule_user_approval_record";--> statement-breakpoint
DROP INDEX "unique_rule_id_user_id";--> statement-breakpoint
ALTER TABLE "policy_rule_user_approval_record" ADD COLUMN "environment_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "policy_rule_role_approval_record" ADD COLUMN "environment_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "policy_rule_any_approval_record" ADD COLUMN "environment_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "policy_rule_user_approval_record" ADD CONSTRAINT "policy_rule_user_approval_record_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_user_approval_record" ADD CONSTRAINT "policy_rule_user_approval_record_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_role_approval_record" ADD CONSTRAINT "policy_rule_role_approval_record_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_role_approval_record" ADD CONSTRAINT "policy_rule_role_approval_record_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_any_approval_record" ADD CONSTRAINT "policy_rule_any_approval_record_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_any_approval_record" ADD CONSTRAINT "policy_rule_any_approval_record_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_deployment_version_id_environment_id_user_id" ON "policy_rule_any_approval_record" USING btree ("deployment_version_id","environment_id","user_id");