CREATE TABLE IF NOT EXISTS "resource_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_metadata" RENAME COLUMN "target_id" TO "resource_id";--> statement-breakpoint
ALTER TABLE "resource_variable" RENAME COLUMN "target_id" TO "resource_id";--> statement-breakpoint
ALTER TABLE "resource_metadata" DROP CONSTRAINT "resource_metadata_target_id_resource_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_variable" DROP CONSTRAINT "resource_variable_target_id_resource_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "resource_metadata_key_target_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "resource_variable_target_id_key_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_session" ADD CONSTRAINT "resource_session_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_session" ADD CONSTRAINT "resource_session_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_metadata" ADD CONSTRAINT "resource_metadata_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_variable" ADD CONSTRAINT "resource_variable_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_metadata_key_resource_id_index" ON "resource_metadata" USING btree ("key","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_variable_resource_id_key_index" ON "resource_variable" USING btree ("resource_id","key");