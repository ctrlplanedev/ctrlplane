ALTER TABLE "environment_policy_approval" RENAME TO "environment_approval";--> statement-breakpoint
ALTER TABLE "environment_approval" RENAME COLUMN "policy_id" TO "environment_id";--> statement-breakpoint
ALTER TABLE "environment_approval" DROP CONSTRAINT "environment_policy_approval_policy_id_environment_policy_id_fk";
--> statement-breakpoint
ALTER TABLE "environment_approval" DROP CONSTRAINT "environment_policy_approval_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "environment_approval" DROP CONSTRAINT "environment_policy_approval_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "environment_policy_approval_policy_id_release_id_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_approval" ADD CONSTRAINT "environment_approval_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_approval" ADD CONSTRAINT "environment_approval_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_approval" ADD CONSTRAINT "environment_approval_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_approval_environment_id_release_id_index" ON "environment_approval" USING btree ("environment_id","release_id");