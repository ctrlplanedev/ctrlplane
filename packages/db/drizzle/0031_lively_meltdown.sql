CREATE TABLE IF NOT EXISTS "deployment_lifecycle_hook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"runbook_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_lifecycle_hook" ADD CONSTRAINT "deployment_lifecycle_hook_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_lifecycle_hook" ADD CONSTRAINT "deployment_lifecycle_hook_runbook_id_runbook_id_fk" FOREIGN KEY ("runbook_id") REFERENCES "public"."runbook"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
