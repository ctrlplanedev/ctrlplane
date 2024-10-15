ALTER TABLE "deployment"
DROP CONSTRAINT "deployment_github_config_file_id_github_config_file_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment"
DROP COLUMN IF EXISTS "github_config_file_id";

DROP TABLE "github_config_file";
--> statement-breakpoint