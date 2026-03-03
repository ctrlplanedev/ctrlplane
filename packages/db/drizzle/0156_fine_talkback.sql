ALTER TABLE "release" DROP CONSTRAINT "release_resource_id_resource_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_environment_id_environment_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_version_id_deployment_version_id_fk";
--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_version_id_deployment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;