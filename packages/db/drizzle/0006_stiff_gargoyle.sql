ALTER TABLE "job" RENAME COLUMN "external_run_id" TO "external_id";--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "external_url" text;