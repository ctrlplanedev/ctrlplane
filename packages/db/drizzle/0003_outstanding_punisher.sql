ALTER TABLE "system" DROP CONSTRAINT "system_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_email_domain_matching" ALTER COLUMN "verification_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_email_domain_matching" ALTER COLUMN "verification_email" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system" ADD CONSTRAINT "system_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
