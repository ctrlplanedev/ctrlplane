ALTER TYPE "public"."scope_type" ADD VALUE 'resourceRelationshipRule' BEFORE 'workspace';--> statement-breakpoint
CREATE TABLE "resource_relationship_rule_target_metadata_equals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_relationship_rule_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_relationship_rule_target_metadata_equals" ADD CONSTRAINT "resource_relationship_rule_target_metadata_equals_resource_relationship_rule_id_resource_relationship_rule_id_fk" FOREIGN KEY ("resource_relationship_rule_id") REFERENCES "public"."resource_relationship_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_resource_relationship_rule_target_metadata_equals" ON "resource_relationship_rule_target_metadata_equals" USING btree ("resource_relationship_rule_id","key");