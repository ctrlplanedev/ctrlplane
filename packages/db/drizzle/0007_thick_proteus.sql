ALTER TABLE "deployment" DROP CONSTRAINT "deployment_github_config_file_id_github_config_file_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment" ADD CONSTRAINT "deployment_github_config_file_id_github_config_file_id_fk" FOREIGN KEY ("github_config_file_id") REFERENCES "public"."github_config_file"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_installation_workspace" ON "github_organization" ("installation_id","workspace_id");--> statement-breakpoint
ALTER TABLE "github_organization" DROP COLUMN IF EXISTS "connected";