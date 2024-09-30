ALTER TYPE "scope_type" ADD VALUE 'deploymentVariable';--> statement-breakpoint
DROP TABLE "deployment_variable_value_target";--> statement-breakpoint
DROP TABLE "deployment_variable_value_target_filter";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP CONSTRAINT "deployment_variable_value_variable_id_deployment_variable_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_variable" ADD COLUMN "default_value_id" uuid DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "target_filter" jsonb DEFAULT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_variable" ADD CONSTRAINT "deployment_variable_default_value_id_deployment_variable_value_id_fk" FOREIGN KEY ("default_value_id") REFERENCES "public"."deployment_variable_value"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_variable_value" ADD CONSTRAINT "deployment_variable_value_variable_id_deployment_variable_id_fk" FOREIGN KEY ("variable_id") REFERENCES "public"."deployment_variable"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
