CREATE TABLE IF NOT EXISTS "workspace_email_domain_matching" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"domain" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_email_domain_matching" ADD CONSTRAINT "workspace_email_domain_matching_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_email_domain_matching_workspace_id_domain_index" ON "workspace_email_domain_matching" USING btree ("workspace_id","domain");