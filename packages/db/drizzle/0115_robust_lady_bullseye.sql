ALTER TABLE "job_agent" DROP CONSTRAINT "job_agent_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "job_agent" ADD CONSTRAINT "job_agent_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;