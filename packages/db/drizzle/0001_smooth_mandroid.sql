DROP TABLE "target_metadata_group_keys";--> statement-breakpoint
ALTER TABLE "target_metadata_group" ADD COLUMN "include_null_combinations" boolean DEFAULT false NOT NULL;