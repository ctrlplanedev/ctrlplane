ALTER TABLE "release" RENAME TO "deployment_version";--> statement-breakpoint
ALTER TABLE "release_channel" RENAME TO "deployment_version_channel";--> statement-breakpoint
ALTER TABLE "release_dependency" RENAME TO "deployment_version_dependency";--> statement-breakpoint
ALTER TABLE "release_metadata" RENAME TO "deployment_version_metadata";--> statement-breakpoint
ALTER TABLE "environment_policy_release_channel" RENAME TO "environment_policy_deployment_version_channel";--> statement-breakpoint
ALTER TABLE "deployment_version" RENAME COLUMN "version" TO "tag";--> statement-breakpoint
ALTER TABLE "deployment_version_channel" RENAME COLUMN "release_filter" TO "deployment_version_selector";--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" RENAME COLUMN "release_id" TO "deployment_version_id";--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" RENAME COLUMN "release_filter" TO "deployment_version_selector";--> statement-breakpoint
ALTER TABLE "release_job_trigger" RENAME COLUMN "release_id" TO "deployment_version_id";--> statement-breakpoint
ALTER TABLE "deployment_version_metadata" RENAME COLUMN "release_id" TO "deployment_version_id";--> statement-breakpoint
ALTER TABLE "environment_policy_approval" DROP CONSTRAINT "environment_policy_approval_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_version" DROP CONSTRAINT "release_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_version_channel" DROP CONSTRAINT "release_channel_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" DROP CONSTRAINT "release_dependency_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" DROP CONSTRAINT "release_dependency_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "release_job_trigger" DROP CONSTRAINT "release_job_trigger_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_version_metadata" DROP CONSTRAINT "release_metadata_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "environment_policy_deployment_version_channel" DROP CONSTRAINT "environment_policy_release_channel_policy_id_environment_policy_id_fk";
--> statement-breakpoint
ALTER TABLE "environment_policy_deployment_version_channel" DROP CONSTRAINT "environment_policy_release_channel_channel_id_release_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "environment_policy_deployment_version_channel" DROP CONSTRAINT "environment_policy_release_channel_deployment_id_deployment_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "release_deployment_id_version_index";--> statement-breakpoint
DROP INDEX IF EXISTS "release_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "release_channel_deployment_id_name_index";--> statement-breakpoint
DROP INDEX IF EXISTS "release_dependency_release_id_deployment_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "release_metadata_key_release_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "environment_policy_release_channel_policy_id_channel_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "environment_policy_release_channel_policy_id_deployment_id_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_approval" ADD CONSTRAINT "environment_policy_approval_release_id_deployment_version_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_version" ADD CONSTRAINT "deployment_version_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_version_channel" ADD CONSTRAINT "deployment_version_channel_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_version_dependency" ADD CONSTRAINT "deployment_version_dependency_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_version_dependency" ADD CONSTRAINT "deployment_version_dependency_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_version_metadata" ADD CONSTRAINT "deployment_version_metadata_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_deployment_version_channel" ADD CONSTRAINT "environment_policy_deployment_version_channel_policy_id_environment_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."environment_policy"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_deployment_version_channel" ADD CONSTRAINT "environment_policy_deployment_version_channel_channel_id_deployment_version_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."deployment_version_channel"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_deployment_version_channel" ADD CONSTRAINT "environment_policy_deployment_version_channel_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_version_deployment_id_tag_index" ON "deployment_version" USING btree ("deployment_id","tag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployment_version_created_at_idx" ON "deployment_version" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_version_channel_deployment_id_name_index" ON "deployment_version_channel" USING btree ("deployment_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_version_dependency_deployment_version_id_deployment_id_index" ON "deployment_version_dependency" USING btree ("deployment_version_id","deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_version_metadata_key_deployment_version_id_index" ON "deployment_version_metadata" USING btree ("key","deployment_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_policy_deployment_version_channel_policy_id_channel_id_index" ON "environment_policy_deployment_version_channel" USING btree ("policy_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_policy_deployment_version_channel_policy_id_deployment_id_index" ON "environment_policy_deployment_version_channel" USING btree ("policy_id","deployment_id");