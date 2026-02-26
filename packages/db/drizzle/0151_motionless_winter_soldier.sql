CREATE TABLE "deployment_variable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"default_value" jsonb
);
--> statement-breakpoint
ALTER TABLE "deployment_variable" ADD CONSTRAINT "deployment_variable_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;