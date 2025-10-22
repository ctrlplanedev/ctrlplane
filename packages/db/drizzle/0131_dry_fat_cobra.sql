CREATE TABLE "workspace_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"partition" integer NOT NULL,
	"num_partitions" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_snapshot" ADD CONSTRAINT "workspace_snapshot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;