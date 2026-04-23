DROP INDEX "deployment_workspace_id_index";--> statement-breakpoint
DROP INDEX "environment_workspace_id_index";--> statement-breakpoint
ALTER TABLE "deployment" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "environment" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_workspace_id_name_unique" UNIQUE("workspace_id","name");--> statement-breakpoint
ALTER TABLE "environment" ADD CONSTRAINT "environment_workspace_id_name_unique" UNIQUE("workspace_id","name");