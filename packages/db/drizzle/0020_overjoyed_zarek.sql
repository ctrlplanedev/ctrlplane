ALTER TABLE "job" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "updated_at" SET NOT NULL;