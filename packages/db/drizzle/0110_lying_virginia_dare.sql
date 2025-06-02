CREATE TABLE "deployment_variable_value_direct" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variable_value_id" uuid NOT NULL,
	"value" jsonb,
	"value_hash" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	CONSTRAINT "deployment_variable_value_direct_variable_value_id_unique" UNIQUE("variable_value_id")
);
--> statement-breakpoint
CREATE TABLE "deployment_variable_value_reference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variable_value_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"path" text[] NOT NULL,
	"default_value" jsonb,
	CONSTRAINT "deployment_variable_value_reference_variable_value_id_unique" UNIQUE("variable_value_id")
);
--> statement-breakpoint
ALTER TABLE "deployment_variable_value_direct" ADD CONSTRAINT "deployment_variable_value_direct_variable_value_id_deployment_variable_value_id_fk" FOREIGN KEY ("variable_value_id") REFERENCES "public"."deployment_variable_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_variable_value_reference" ADD CONSTRAINT "deployment_variable_value_reference_variable_value_id_deployment_variable_value_id_fk" FOREIGN KEY ("variable_value_id") REFERENCES "public"."deployment_variable_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP COLUMN "value_type";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP COLUMN "value";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP COLUMN "sensitive";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP COLUMN "reference";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "deployment_variable_value" DROP COLUMN "default_value";--> statement-breakpoint
DROP TYPE "public"."value_type";