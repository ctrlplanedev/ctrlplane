ALTER TABLE "policy_skip" DROP CONSTRAINT "policy_skip_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "policy_skip" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "policy_skip" ALTER COLUMN "created_by" SET DEFAULT '';