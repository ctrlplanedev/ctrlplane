CREATE TABLE IF NOT EXISTS "deployment_resource_relationship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"resource_identifier" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_resource_relationship" ADD CONSTRAINT "deployment_resource_relationship_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_resource_relationship" ADD CONSTRAINT "deployment_resource_relationship_resource_identifier_workspace_id_resource_identifier_workspace_id_fk" FOREIGN KEY ("resource_identifier","workspace_id") REFERENCES "public"."resource"("identifier","workspace_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_resource_relationship_workspace_id_resource_identifier_index" ON "deployment_resource_relationship" USING btree ("workspace_id","resource_identifier");