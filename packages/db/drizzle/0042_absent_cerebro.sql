CREATE TABLE IF NOT EXISTS "job_resource_relationship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"resource_identifier" text NOT NULL
);
--> statement-breakpoint
DROP TABLE "deployment_resource_relationship";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_resource_relationship" ADD CONSTRAINT "job_resource_relationship_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_resource_relationship_job_id_resource_identifier_index" ON "job_resource_relationship" USING btree ("job_id","resource_identifier");