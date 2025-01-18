CREATE TABLE IF NOT EXISTS "environment_policy_approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"status" "approval_status_type" DEFAULT 'pending' NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
DROP TABLE "environment_approval";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_approval" ADD CONSTRAINT "environment_policy_approval_policy_id_environment_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."environment_policy"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_approval" ADD CONSTRAINT "environment_policy_approval_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_approval" ADD CONSTRAINT "environment_policy_approval_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_policy_approval_policy_id_release_id_index" ON "environment_policy_approval" USING btree ("policy_id","release_id");