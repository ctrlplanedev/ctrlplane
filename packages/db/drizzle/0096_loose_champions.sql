ALTER TABLE "resource_relationship_rule" RENAME COLUMN "relationship_type" TO "dependency_type";--> statement-breakpoint
ALTER TABLE "resource_variable" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_variable" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "resource_variable" ADD COLUMN "path" text[];--> statement-breakpoint
ALTER TABLE "resource_variable" ADD COLUMN "default_value" jsonb;--> statement-breakpoint
ALTER TABLE "resource_variable" ADD COLUMN "value_type" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_relationship_rule" ADD COLUMN "dependency_description" text;