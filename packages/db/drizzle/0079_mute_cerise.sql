ALTER TABLE "deployment_variable_value" RENAME COLUMN "resource_filter" TO "resource_selector";--> statement-breakpoint
ALTER TABLE "deployment" RENAME COLUMN "resource_filter" TO "resource_selector";--> statement-breakpoint
ALTER TABLE "environment" RENAME COLUMN "resource_filter" TO "resource_selector";--> statement-breakpoint
ALTER TABLE "resource_view" RENAME COLUMN "filter" TO "selector";--> statement-breakpoint