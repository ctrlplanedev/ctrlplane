ALTER TABLE "job" DROP CONSTRAINT "job_job_agent_id_job_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "job_agent_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job" ADD CONSTRAINT "job_job_agent_id_job_agent_id_fk" FOREIGN KEY ("job_agent_id") REFERENCES "public"."job_agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
