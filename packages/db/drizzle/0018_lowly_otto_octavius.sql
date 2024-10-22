CREATE TABLE IF NOT EXISTS "target_view_metadata_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"view_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "target_view_metadata_group_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"key" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_view_metadata_group" ADD CONSTRAINT "target_view_metadata_group_view_id_target_view_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."target_view"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_view_metadata_group_key" ADD CONSTRAINT "target_view_metadata_group_key_group_id_target_view_metadata_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."target_view_metadata_group"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
