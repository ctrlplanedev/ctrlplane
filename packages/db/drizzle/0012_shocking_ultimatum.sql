ALTER TABLE "deployment" DROP CONSTRAINT "deployment_job_agent_id_job_agent_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment" ADD CONSTRAINT "deployment_job_agent_id_job_agent_id_fk" FOREIGN KEY ("job_agent_id") REFERENCES "public"."job_agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_installation_workspace" ON "github_organization" ("installation_id","workspace_id");--> statement-breakpoint
ALTER TABLE "github_organization" DROP COLUMN IF EXISTS "connected";