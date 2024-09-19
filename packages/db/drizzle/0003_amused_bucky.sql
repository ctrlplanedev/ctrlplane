ALTER TABLE "workspace_email_domain_matching" ADD COLUMN "role_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_email_domain_matching" ADD CONSTRAINT "workspace_email_domain_matching_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
