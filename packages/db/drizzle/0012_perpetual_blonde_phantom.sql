CREATE TABLE IF NOT EXISTS "value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"value_set_id" uuid NOT NULL,
	"key" text,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment" DROP CONSTRAINT "deployment_job_agent_id_job_agent_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value" ADD CONSTRAINT "value_value_set_id_value_set_id_fk" FOREIGN KEY ("value_set_id") REFERENCES "public"."value_set"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_set" ADD CONSTRAINT "value_set_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_value_set_id_key_value_index" ON "value" ("value_set_id","key","value");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment" ADD CONSTRAINT "deployment_job_agent_id_job_agent_id_fk" FOREIGN KEY ("job_agent_id") REFERENCES "public"."job_agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_installation_workspace" ON "github_organization" ("installation_id","workspace_id");--> statement-breakpoint
ALTER TABLE "github_organization" DROP COLUMN IF EXISTS "connected";