DO $$ BEGIN
 CREATE TYPE "public"."target_relationship_type" AS ENUM('depends_on', 'created_by');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "evaluation_type" ADD VALUE 'filter';--> statement-breakpoint
ALTER TABLE "environment_policy" DROP COLUMN IF EXISTS "evaluate";