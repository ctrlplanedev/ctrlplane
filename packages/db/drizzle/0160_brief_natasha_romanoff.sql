CREATE TABLE "computed_entity_relationship" (
	"rule_id" uuid NOT NULL,
	"from_entity_type" text NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_type" text NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"last_evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "computed_entity_relationship_rule_id_from_entity_type_from_entity_id_to_entity_type_to_entity_id_pk" PRIMARY KEY("rule_id","from_entity_type","from_entity_id","to_entity_type","to_entity_id")
);
--> statement-breakpoint
CREATE TABLE "relationship_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workspace_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"cel" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
ALTER TABLE "computed_entity_relationship" ADD CONSTRAINT "computed_entity_relationship_rule_id_relationship_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."relationship_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_rule" ADD CONSTRAINT "relationship_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "relationship_rule_workspace_id_reference_index" ON "relationship_rule" USING btree ("workspace_id","reference");--> statement-breakpoint
CREATE INDEX "relationship_rule_workspace_id_index" ON "relationship_rule" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "resource_workspace_id_active_idx" ON "resource" USING btree ("workspace_id");