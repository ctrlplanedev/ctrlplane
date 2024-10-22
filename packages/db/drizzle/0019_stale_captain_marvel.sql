ALTER TABLE "environment_policy" ADD COLUMN "release_filter" jsonb DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "environment_policy" DROP COLUMN IF EXISTS "evaluate_with";--> statement-breakpoint
ALTER TABLE "environment_policy" DROP COLUMN IF EXISTS "evaluate";