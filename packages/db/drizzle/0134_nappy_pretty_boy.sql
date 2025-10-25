CREATE TABLE "changelog_entry" (
	"workspace_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_entry_workspace_id_entity_type_entity_id_pk" PRIMARY KEY("workspace_id","entity_type","entity_id")
);
--> statement-breakpoint
ALTER TABLE "changelog_entry" ADD CONSTRAINT "changelog_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;