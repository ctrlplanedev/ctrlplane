CREATE TABLE IF NOT EXISTS "job_variable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variable_set" DROP CONSTRAINT "variable_set_system_id_system_id_fk";
--> statement-breakpoint
ALTER TABLE "variable_set_value" DROP CONSTRAINT "variable_set_value_variable_set_id_variable_set_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "variable_set_value_variable_set_id_key_value_index";--> statement-breakpoint
ALTER TABLE "variable_set_value" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_variable" ADD CONSTRAINT "job_variable_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_variable_job_id_key_index" ON "job_variable" ("job_id","key");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set" ADD CONSTRAINT "variable_set_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_value" ADD CONSTRAINT "variable_set_value_variable_set_id_variable_set_id_fk" FOREIGN KEY ("variable_set_id") REFERENCES "public"."variable_set"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variable_set_value_variable_set_id_key_index" ON "variable_set_value" ("variable_set_id","key");