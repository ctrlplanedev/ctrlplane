ALTER TABLE "deployment" ADD COLUMN "job_agent_selector" text DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "job_agent_config" jsonb DEFAULT '{}';--> statement-breakpoint
UPDATE deployment d
SET job_agent_selector = 'jobAgent.id == "' || dja.job_agent_id || '"',
    job_agent_config = dja.config
FROM deployment_job_agent dja
WHERE dja.deployment_id = d.id;