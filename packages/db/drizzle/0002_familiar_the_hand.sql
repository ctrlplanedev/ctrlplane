ALTER TABLE "system" DROP CONSTRAINT "system_workspace_id_workspace_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system" ADD CONSTRAINT "system_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
