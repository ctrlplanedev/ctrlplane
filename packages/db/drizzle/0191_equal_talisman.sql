CREATE TABLE "deployment_version_dependency" (
	"deployment_version_id" uuid NOT NULL,
	"dependency_deployment_id" uuid NOT NULL,
	"version_selector" text DEFAULT 'false' NOT NULL,
	CONSTRAINT "deployment_version_dependency_deployment_version_id_dependency_deployment_id_pk" PRIMARY KEY("deployment_version_id","dependency_deployment_id")
);
--> statement-breakpoint
DROP TABLE "deployment_dependency" CASCADE;--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" ADD CONSTRAINT "deployment_version_dependency_deployment_version_id_deployment_version_id_fk" FOREIGN KEY ("deployment_version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_version_dependency" ADD CONSTRAINT "deployment_version_dependency_dependency_deployment_id_deployment_id_fk" FOREIGN KEY ("dependency_deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;