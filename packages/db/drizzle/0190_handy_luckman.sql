CREATE TABLE "deployment_dependency" (
	"deployment_id" uuid NOT NULL,
	"dependency_deployment_id" uuid NOT NULL,
	"version_selector" text DEFAULT 'false' NOT NULL,
	CONSTRAINT "deployment_dependency_deployment_id_dependency_deployment_id_pk" PRIMARY KEY("deployment_id","dependency_deployment_id")
);
--> statement-breakpoint
ALTER TABLE "deployment_dependency" ADD CONSTRAINT "deployment_dependency_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_dependency" ADD CONSTRAINT "deployment_dependency_dependency_deployment_id_deployment_id_fk" FOREIGN KEY ("dependency_deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;