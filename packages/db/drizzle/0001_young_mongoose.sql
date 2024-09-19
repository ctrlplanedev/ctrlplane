CREATE TABLE IF NOT EXISTS "target_label_group_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_variable_value_target_filter" RENAME COLUMN "labels" TO "target_filter";--> statement-breakpoint
ALTER TABLE "deployment_variable_value_target_filter" ALTER COLUMN "target_filter" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "deployment_variable_value_target_filter" ALTER COLUMN "target_filter" DROP NOT NULL;