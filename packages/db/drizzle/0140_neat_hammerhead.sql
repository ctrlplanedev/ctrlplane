ALTER TABLE "deployment_version" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "environment" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "system" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_version" ADD CONSTRAINT "deployment_version_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment" ADD CONSTRAINT "environment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;