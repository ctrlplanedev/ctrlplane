ALTER TABLE "environment_policy" DROP CONSTRAINT "environment_policy_system_id_system_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy" ADD CONSTRAINT "environment_policy_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
