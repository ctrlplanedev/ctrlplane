CREATE TABLE IF NOT EXISTS "variable_set_assignment" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "variable_set_id" uuid NOT NULL,
    "environment_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variable_set_value" DROP COLUMN "value";

ALTER TABLE "variable_set_value" ADD COLUMN "value" jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_assignment" ADD CONSTRAINT "variable_set_assignment_variable_set_id_variable_set_id_fk" FOREIGN KEY ("variable_set_id") REFERENCES "public"."variable_set"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_assignment" ADD CONSTRAINT "variable_set_assignment_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;