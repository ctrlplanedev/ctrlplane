CREATE TYPE "public"."value_type" AS ENUM('direct', 'reference');--> statement-breakpoint
DROP INDEX "deployment_variable_value_variable_id_value_index";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "value_type" "value_type" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "path" text[];--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "default_value" jsonb;
ALTER TABLE "deployment_variable_value" ADD CONSTRAINT valid_value_type CHECK (
  (value_type = 'direct' AND value IS NOT NULL AND reference IS NULL AND path IS NULL AND default_value IS NULL) OR
  (value_type = 'reference' AND value IS NULL AND reference IS NOT NULL AND path IS NOT NULL)
);--> statement-breakpoint
