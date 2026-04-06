CREATE TABLE "deployment_job_agent" (
	"deployment_id" uuid NOT NULL,
	"job_agent_id" uuid NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "deployment_job_agent_deployment_id_job_agent_id_pk" PRIMARY KEY("deployment_id","job_agent_id")
);
--> statement-breakpoint
ALTER TABLE "deployment_job_agent" ADD CONSTRAINT "deployment_job_agent_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_job_agent" ADD CONSTRAINT "deployment_job_agent_job_agent_id_job_agent_id_fk" FOREIGN KEY ("job_agent_id") REFERENCES "public"."job_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO deployment_job_agent (deployment_id, job_agent_id, config)
SELECT d.id, (agent->>'ref')::uuid, COALESCE(agent->'config', '{}'::jsonb)
FROM deployment d,
     jsonb_array_elements(d.job_agents) AS agent
WHERE d.job_agents IS NOT NULL
  AND jsonb_array_length(d.job_agents) > 0
  AND EXISTS (SELECT 1 FROM job_agent ja WHERE ja.id = (agent->>'ref')::uuid)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "job_agent_id";--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "job_agent_config";--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "job_agents";
