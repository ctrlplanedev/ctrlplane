ALTER TABLE "release_dependency" ALTER COLUMN "release_filter" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "release_dependency" ALTER COLUMN "release_filter" DROP NOT NULL;