ALTER TYPE "target_relationship_type" ADD VALUE 'associated_with';--> statement-breakpoint
ALTER TYPE "target_relationship_type" ADD VALUE 'extends';--> statement-breakpoint
ALTER TABLE "release_dependency" DROP CONSTRAINT "release_dependency_target_metadata_group_id_target_metadata_group_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "release_dependency_release_id_deployment_id_target_metadata_group_id_index";--> statement-breakpoint
ALTER TABLE "target_relationship" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "target_relationship" ADD COLUMN "type" "target_relationship_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "release_dependency" ADD COLUMN "release_filter" jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "release_dependency_release_id_deployment_id_index" ON "release_dependency" USING btree ("release_id","deployment_id");--> statement-breakpoint
ALTER TABLE "target_relationship" DROP COLUMN IF EXISTS "uuid";--> statement-breakpoint
ALTER TABLE "target_relationship" DROP COLUMN IF EXISTS "relationship_type";--> statement-breakpoint
ALTER TABLE "release_dependency" DROP COLUMN IF EXISTS "target_metadata_group_id";--> statement-breakpoint
ALTER TABLE "release_dependency" DROP COLUMN IF EXISTS "rule_type";--> statement-breakpoint
ALTER TABLE "release_dependency" DROP COLUMN IF EXISTS "rule";