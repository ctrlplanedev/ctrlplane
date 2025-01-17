DO $$ BEGIN
 CREATE TYPE "public"."release_status" AS ENUM('building', 'ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "release_job_trigger_type" ADD VALUE 'release_updated';--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "status" "release_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "message" text;