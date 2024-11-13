ALTER TYPE "release_job_trigger_type" ADD VALUE 'new_resource';
--> statement-breakpoint
ALTER TYPE "release_job_trigger_type" ADD VALUE 'resource_changed';
--> statement-breakpoint
ALTER TYPE "scope_type" ADD VALUE 'resource';
--> statement-breakpoint
ALTER TYPE "scope_type" ADD VALUE 'resourceProvider';
--> statement-breakpoint
ALTER TYPE "scope_type" ADD VALUE 'resourceMetadataGroup';
--> statement-breakpoint
ALTER TYPE "scope_type" ADD VALUE 'resourceView';
--> statement-breakpoint
ALTER TABLE "target" RENAME TO "resource";
--> statement-breakpoint
ALTER TABLE "target_metadata" RENAME TO "resource_metadata";
--> statement-breakpoint
ALTER TABLE "target_relationship" RENAME TO "resource_relationship";
--> statement-breakpoint
ALTER TABLE "target_schema" RENAME TO "resource_schema";
--> statement-breakpoint
ALTER TABLE "target_variable" RENAME TO "resource_variable";
--> statement-breakpoint
ALTER TABLE "target_view" RENAME TO "resource_view";
--> statement-breakpoint
ALTER TABLE "target_provider" RENAME TO "resource_provider";
--> statement-breakpoint
ALTER TABLE "target_provider_google"
RENAME TO "resource_provider_google";
--> statement-breakpoint
ALTER TABLE "target_metadata_group"
RENAME TO "resource_metadata_group";
--> statement-breakpoint
ALTER TABLE "deployment_variable_value"
RENAME COLUMN "target_filter" TO "resource_filter";
--> statement-breakpoint
ALTER TABLE "environment"
RENAME COLUMN "target_filter" TO "resource_filter";
--> statement-breakpoint
ALTER TABLE "resource_provider_google"
RENAME COLUMN "target_provider_id" TO "resource_provider_id";
--> statement-breakpoint
ALTER TABLE "release_job_trigger"
RENAME COLUMN "target_id" TO "resource_id";
--> statement-breakpoint
ALTER TABLE "resource"
DROP CONSTRAINT "target_provider_id_target_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "resource"
DROP CONSTRAINT "target_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_metadata"
DROP CONSTRAINT "target_metadata_target_id_target_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_relationship"
DROP CONSTRAINT "target_relationship_source_id_target_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_relationship"
DROP CONSTRAINT "target_relationship_target_id_target_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_schema"
DROP CONSTRAINT "target_schema_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_variable"
DROP CONSTRAINT "target_variable_target_id_target_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_view"
DROP CONSTRAINT "target_view_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_provider"
DROP CONSTRAINT "target_provider_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_provider_google"
DROP CONSTRAINT "target_provider_google_target_provider_id_target_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "release_job_trigger"
DROP CONSTRAINT "release_job_trigger_target_id_target_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_metadata_group"
DROP CONSTRAINT "target_metadata_group_workspace_id_workspace_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "target_identifier_workspace_id_index";
--> statement-breakpoint
DROP INDEX IF EXISTS "target_metadata_key_target_id_index";
--> statement-breakpoint
DROP INDEX IF EXISTS "target_relationship_target_id_source_id_index";
--> statement-breakpoint
DROP INDEX IF EXISTS "target_schema_version_kind_workspace_id_index";
--> statement-breakpoint
DROP INDEX IF EXISTS "target_variable_target_id_key_index";
--> statement-breakpoint
DROP INDEX IF EXISTS "target_provider_workspace_id_name_index";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource" ADD CONSTRAINT "resource_provider_id_resource_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."resource_provider"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource" ADD CONSTRAINT "resource_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_metadata" ADD CONSTRAINT "resource_metadata_target_id_resource_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_relationship" ADD CONSTRAINT "resource_relationship_source_id_resource_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_relationship" ADD CONSTRAINT "resource_relationship_target_id_resource_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_schema" ADD CONSTRAINT "resource_schema_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_variable" ADD CONSTRAINT "resource_variable_target_id_resource_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_view" ADD CONSTRAINT "resource_view_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_provider" ADD CONSTRAINT "resource_provider_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_provider_google" ADD CONSTRAINT "resource_provider_google_resource_provider_id_resource_provider_id_fk" FOREIGN KEY ("resource_provider_id") REFERENCES "public"."resource_provider"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_job_trigger" ADD CONSTRAINT "release_job_trigger_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_metadata_group" ADD CONSTRAINT "resource_metadata_group_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_identifier_workspace_id_index" ON "resource" USING btree ("identifier", "workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_metadata_key_target_id_index" ON "resource_metadata" USING btree ("key", "target_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_relationship_target_id_source_id_index" ON "resource_relationship" USING btree ("target_id", "source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_schema_version_kind_workspace_id_index" ON "resource_schema" USING btree (
    "version",
    "kind",
    "workspace_id"
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_variable_target_id_key_index" ON "resource_variable" USING btree ("target_id", "key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_provider_workspace_id_name_index" ON "resource_provider" USING btree ("workspace_id", "name");
--> statement-breakpoint
ALTER TYPE "target_relationship_type"
RENAME TO "resource_relationship_type";
--> statement-breakpoint