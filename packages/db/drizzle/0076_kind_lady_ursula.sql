ALTER TABLE "deployment_variable" DROP CONSTRAINT "deployment_variable_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_variable_set" DROP CONSTRAINT "deployment_variable_set_deployment_id_deployment_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_variable" ADD CONSTRAINT "deployment_variable_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_variable_set" ADD CONSTRAINT "deployment_variable_set_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
