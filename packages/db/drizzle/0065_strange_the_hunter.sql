ALTER TABLE "environment_policy" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy" ADD CONSTRAINT "environment_policy_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
