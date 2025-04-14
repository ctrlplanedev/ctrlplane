CREATE TABLE IF NOT EXISTS "computed_deployment_resource" (
	"deployment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "computed_deployment_resource_deployment_id_resource_id_pk" PRIMARY KEY("deployment_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "computed_environment_resource" (
	"environment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "computed_environment_resource_environment_id_resource_id_pk" PRIMARY KEY("environment_id","resource_id")
);
--> statement-breakpoint
DROP TABLE "deployment_selector_computed_resource";--> statement-breakpoint
DROP TABLE "environment_selector_computed_resource";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "computed_deployment_resource" ADD CONSTRAINT "computed_deployment_resource_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "computed_deployment_resource" ADD CONSTRAINT "computed_deployment_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "computed_environment_resource" ADD CONSTRAINT "computed_environment_resource_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "computed_environment_resource" ADD CONSTRAINT "computed_environment_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
