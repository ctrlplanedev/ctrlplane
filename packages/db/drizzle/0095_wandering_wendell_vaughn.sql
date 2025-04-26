CREATE TABLE "resource_relationship_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reference" text NOT NULL,
	"relationship_type" text NOT NULL,
	"description" text,
	"source_kind" text NOT NULL,
	"source_version" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_relationship_rule_metadata_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_relationship_rule_id" uuid NOT NULL,
	"key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_relationship_rule" ADD CONSTRAINT "resource_relationship_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relationship_rule_metadata_match" ADD CONSTRAINT "resource_relationship_rule_metadata_match_resource_relationship_rule_id_resource_relationship_rule_id_fk" FOREIGN KEY ("resource_relationship_rule_id") REFERENCES "public"."resource_relationship_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_resource_relationship_rule_reference" ON "resource_relationship_rule" USING btree ("workspace_id","reference","source_kind","source_version");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_resource_relationship_rule_metadata_match" ON "resource_relationship_rule_metadata_match" USING btree ("resource_relationship_rule_id","key");