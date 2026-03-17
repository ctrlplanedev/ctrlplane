ALTER TABLE "reconcile_work_payload" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "reconcile_work_payload" CASCADE;--> statement-breakpoint
ALTER TABLE "reconcile_work_scope" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reconcile_work_scope" ADD COLUMN "last_error" text;--> statement-breakpoint
CREATE INDEX "reconcile_work_scope_expired_claims_idx" ON "reconcile_work_scope" USING btree ("claimed_until") WHERE "reconcile_work_scope"."claimed_until" is not null;