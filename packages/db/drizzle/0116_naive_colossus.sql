ALTER TABLE "resource_provider" DROP CONSTRAINT "resource_provider_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_provider" ADD CONSTRAINT "resource_provider_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;