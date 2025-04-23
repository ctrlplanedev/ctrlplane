ALTER TABLE "deployment" DROP CONSTRAINT "deployment_system_id_system_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;