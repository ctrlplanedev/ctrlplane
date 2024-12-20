CREATE INDEX IF NOT EXISTS "job_created_at_idx" ON "job" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_idx" ON "job" USING btree ("status");