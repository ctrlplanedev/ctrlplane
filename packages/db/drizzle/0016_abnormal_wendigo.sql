CREATE TABLE IF NOT EXISTS "workspace_google_integration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"service_account_email" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_google_integration" ADD CONSTRAINT "workspace_google_integration_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_google_integration_workspace_id_project_id_index" ON "workspace_google_integration" USING btree ("workspace_id","project_id");--> statement-breakpoint
ALTER TABLE "workspace" DROP COLUMN IF EXISTS "google_service_account_email";