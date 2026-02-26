CREATE TABLE "deployment_variable_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_variable_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"resource_selector" text,
	"priority" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD CONSTRAINT "deployment_variable_value_deployment_variable_id_deployment_variable_id_fk" FOREIGN KEY ("deployment_variable_id") REFERENCES "public"."deployment_variable"("id") ON DELETE cascade ON UPDATE no action;