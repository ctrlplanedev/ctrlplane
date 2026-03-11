CREATE TABLE "resource_aggregate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" uuid,
	"filter" text DEFAULT 'true' NOT NULL,
	"group_by" jsonb
);
--> statement-breakpoint
ALTER TABLE "resource_aggregate" ADD CONSTRAINT "resource_aggregate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_aggregate" ADD CONSTRAINT "resource_aggregate_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_aggregate_workspace_id_index" ON "resource_aggregate" USING btree ("workspace_id");