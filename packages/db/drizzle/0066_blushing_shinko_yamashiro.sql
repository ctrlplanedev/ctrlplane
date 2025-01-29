ALTER TABLE "environment_policy" ALTER COLUMN "approval_required" SET DEFAULT 'automatic';--> statement-breakpoint

UPDATE "environment_policy" SET "approval_required" = 'automatic' WHERE "environment_id" IS NOT NULL;