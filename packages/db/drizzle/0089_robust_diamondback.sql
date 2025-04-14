CREATE TABLE IF NOT EXISTS "deployment_selector_computed_resource" (
	"deployment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "deployment_selector_computed_resource_deployment_id_resource_id_pk" PRIMARY KEY("deployment_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environment_selector_computed_resource" (
	"environment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "environment_selector_computed_resource_environment_id_resource_id_pk" PRIMARY KEY("environment_id","resource_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_selector_computed_resource" ADD CONSTRAINT "deployment_selector_computed_resource_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_selector_computed_resource" ADD CONSTRAINT "deployment_selector_computed_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_selector_computed_resource" ADD CONSTRAINT "environment_selector_computed_resource_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_selector_computed_resource" ADD CONSTRAINT "environment_selector_computed_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
