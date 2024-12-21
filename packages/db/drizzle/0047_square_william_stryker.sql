ALTER TABLE "environment_policy" ALTER COLUMN "concurrency_limit" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "environment_policy" ALTER COLUMN "concurrency_limit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "environment_policy" DROP COLUMN IF EXISTS "concurrency_type";