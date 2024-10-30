ALTER TABLE "environment" ADD COLUMN "expires_at" timestamp with time zone DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "environment" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "environment_policy" DROP COLUMN IF EXISTS "ephemeral_duration";