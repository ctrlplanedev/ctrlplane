ALTER TABLE "target_relationship" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "target_relationship" DROP COLUMN IF EXISTS "uuid";