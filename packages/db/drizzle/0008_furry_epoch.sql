CREATE TABLE IF NOT EXISTS "workspace_invite_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "workspace_invite_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DROP TABLE "workspace_member" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workspace_invite_link" CASCADE;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_invite_token" ADD CONSTRAINT "workspace_invite_token_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_invite_token" ADD CONSTRAINT "workspace_invite_token_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_invite_token" ADD CONSTRAINT "workspace_invite_token_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_role_role_id_entity_type_entity_id_scope_id_scope_type_index" ON "entity_role" ("role_id","entity_type","entity_id","scope_id","scope_type");