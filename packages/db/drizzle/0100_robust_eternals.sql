CREATE TYPE "public"."value_type" AS ENUM('direct', 'reference');--> statement-breakpoint
DROP INDEX "deployment_variable_value_variable_id_value_index";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "value_type" "value_type" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "path" text[];--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "default_value" jsonb;