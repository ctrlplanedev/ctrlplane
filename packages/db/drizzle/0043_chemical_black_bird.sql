ALTER TABLE "resource_relationship" RENAME COLUMN "source_id" TO "from_identifier";--> statement-breakpoint
ALTER TABLE "resource_relationship" RENAME COLUMN "target_id" TO "to_identifier";--> statement-breakpoint
ALTER TABLE "resource_relationship" DROP CONSTRAINT "resource_relationship_source_id_resource_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_relationship" DROP CONSTRAINT "resource_relationship_target_id_resource_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "resource_relationship_target_id_source_id_index";--> statement-breakpoint
ALTER TABLE "resource_relationship" ALTER COLUMN "from_identifier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "resource_relationship" ALTER COLUMN "to_identifier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "resource_relationship" ADD COLUMN "workspace_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_relationship" ADD CONSTRAINT "resource_relationship_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_relationship_to_identifier_from_identifier_index" ON "resource_relationship" USING btree ("to_identifier","from_identifier");