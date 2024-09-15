CREATE TABLE IF NOT EXISTS "deployment_variable_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"variable_set_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_variable_set" ADD CONSTRAINT "deployment_variable_set_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_variable_set" ADD CONSTRAINT "deployment_variable_set_variable_set_id_variable_set_id_fk" FOREIGN KEY ("variable_set_id") REFERENCES "public"."variable_set"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_variable_set_deployment_id_variable_set_id_index" ON "deployment_variable_set" ("deployment_id","variable_set_id");