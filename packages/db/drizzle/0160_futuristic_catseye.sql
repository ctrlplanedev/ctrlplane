CREATE TABLE "relationship_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workspace_id" uuid NOT NULL,
	"from_type" text NOT NULL,
	"to_type" text NOT NULL,
	"relationship_type" text NOT NULL,
	"reference" text NOT NULL,
	"from_selector" text,
	"to_selector" text,
	"matcher" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relationship_rule" ADD CONSTRAINT "relationship_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;