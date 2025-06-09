ALTER TABLE "deployment" ADD COLUMN "last_computed_at" timestamp with time zone DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "environment" ADD COLUMN "last_computed_at" timestamp with time zone DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "policy_target" ADD COLUMN "last_computed_at" timestamp with time zone DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "release_target" ADD COLUMN "last_computed_at" timestamp with time zone DEFAULT NULL;