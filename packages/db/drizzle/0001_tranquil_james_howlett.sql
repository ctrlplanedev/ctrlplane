ALTER TABLE "release" DROP CONSTRAINT "release_deployment_id_deployment_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release" ADD CONSTRAINT "release_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_organization_repository_path" ON "github_config_file" ("organization_id","repository_name","path");--> statement-breakpoint
ALTER TABLE "github_config_file" DROP COLUMN IF EXISTS "branch";--> statement-breakpoint
ALTER TABLE "github_config_file" DROP COLUMN IF EXISTS "name";