CREATE TABLE "release_target_desired_release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"desired_release_id" uuid
);
--> statement-breakpoint
ALTER TABLE "release_target_desired_release" ADD CONSTRAINT "release_target_desired_release_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_target_desired_release" ADD CONSTRAINT "release_target_desired_release_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_target_desired_release" ADD CONSTRAINT "release_target_desired_release_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_target_desired_release" ADD CONSTRAINT "release_target_desired_release_desired_release_id_release_id_fk" FOREIGN KEY ("desired_release_id") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_target_desired_release_resource_id_environment_id_deployment_id_index" ON "release_target_desired_release" USING btree ("resource_id","environment_id","deployment_id");