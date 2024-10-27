ALTER TABLE "variable_set_assignment" RENAME TO "variable_set_environment";--> statement-breakpoint
ALTER TABLE "variable_set_environment" DROP CONSTRAINT "variable_set_assignment_variable_set_id_variable_set_id_fk";
--> statement-breakpoint
ALTER TABLE "variable_set_environment" DROP CONSTRAINT "variable_set_assignment_environment_id_environment_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_environment" ADD CONSTRAINT "variable_set_environment_variable_set_id_variable_set_id_fk" FOREIGN KEY ("variable_set_id") REFERENCES "public"."variable_set"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_environment" ADD CONSTRAINT "variable_set_environment_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
