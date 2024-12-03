ALTER TYPE "release_job_trigger_type" ADD VALUE 'retry';--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;