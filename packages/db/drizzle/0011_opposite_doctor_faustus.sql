ALTER TYPE "scope_type" ADD VALUE 'variableSet';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variable_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variable_set_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"variable_set_id" uuid NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
DROP TABLE "value";--> statement-breakpoint
DROP TABLE "value_set";--> statement-breakpoint
ALTER TABLE "runbook" DROP CONSTRAINT "runbook_job_agent_id_job_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "runbook" ALTER COLUMN "job_agent_config" SET DATA TYPE jsonb USING job_agent_config::jsonb;--> statement-breakpoint
ALTER TABLE "runbook" ALTER COLUMN "job_agent_config" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "runbook" ALTER COLUMN "job_agent_config" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "runbook_variable" ALTER COLUMN "required" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "runbook" ADD COLUMN "system_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "runbook_variable" ADD COLUMN "value" jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set" ADD CONSTRAINT "variable_set_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_value" ADD CONSTRAINT "variable_set_value_variable_set_id_variable_set_id_fk" FOREIGN KEY ("variable_set_id") REFERENCES "public"."variable_set"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variable_set_value_variable_set_id_key_value_index" ON "variable_set_value" ("variable_set_id","key","value");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runbook" ADD CONSTRAINT "runbook_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runbook" ADD CONSTRAINT "runbook_job_agent_id_job_agent_id_fk" FOREIGN KEY ("job_agent_id") REFERENCES "public"."job_agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "runbook_variable_runbook_id_key_index" ON "runbook_variable" ("runbook_id","key");--> statement-breakpoint
ALTER TABLE "runbook_variable" DROP COLUMN IF EXISTS "default_value";