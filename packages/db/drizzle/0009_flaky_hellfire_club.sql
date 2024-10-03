CREATE TABLE IF NOT EXISTS "target_relationship" (
	"uuid" uuid,
	"source_id" uuid NOT NULL,
	"relationship_type" "target_relationship_type" NOT NULL,
	"target_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "release_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release" RENAME COLUMN "metadata" TO "config";--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_relationship" ADD CONSTRAINT "target_relationship_source_id_target_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."target"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_relationship" ADD CONSTRAINT "target_relationship_target_id_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."target"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_metadata" ADD CONSTRAINT "release_metadata_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_metadata" ADD CONSTRAINT "job_metadata_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "target_relationship_target_id_source_id_index" ON "target_relationship" USING btree ("target_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "release_metadata_key_release_id_index" ON "release_metadata" USING btree ("key","release_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_metadata_key_job_id_index" ON "job_metadata" USING btree ("key","job_id");--> statement-breakpoint
ALTER TABLE "release" DROP COLUMN IF EXISTS "notes";--> statement-breakpoint
ALTER TABLE "job" DROP COLUMN IF EXISTS "external_url";