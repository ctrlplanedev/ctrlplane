-- First, add the target_key column as nullable
ALTER TABLE "resource_relationship_rule_metadata_match" ADD COLUMN "target_key" text;--> statement-breakpoint

-- Copy the existing key values to target_key for all existing rows
UPDATE "resource_relationship_rule_metadata_match" SET "target_key" = "key";--> statement-breakpoint

-- Now make target_key NOT NULL since all rows have values
ALTER TABLE "resource_relationship_rule_metadata_match" ALTER COLUMN "target_key" SET NOT NULL;--> statement-breakpoint

-- Rename the key column to source_key
ALTER TABLE "resource_relationship_rule_metadata_match" RENAME COLUMN "key" TO "source_key";--> statement-breakpoint

-- Drop the old index
DROP INDEX "unique_resource_relationship_rule_metadata_match";--> statement-breakpoint

-- Create the new index with both source_key and target_key
CREATE UNIQUE INDEX "unique_resource_relationship_rule_metadata_match" ON "resource_relationship_rule_metadata_match" USING btree ("resource_relationship_rule_id","source_key","target_key");