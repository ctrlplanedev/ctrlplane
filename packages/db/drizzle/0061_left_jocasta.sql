DO $$ BEGIN
 CREATE TYPE "public"."github_entity_type" AS ENUM('organization', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "github_organization" RENAME TO "github_entity";--> statement-breakpoint
ALTER TABLE "github_entity" RENAME COLUMN "organization_name" TO "slug";--> statement-breakpoint
ALTER TABLE "github_entity" DROP CONSTRAINT "github_organization_added_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "github_entity" DROP CONSTRAINT "github_organization_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "github_entity" ADD COLUMN "type" "github_entity_type" DEFAULT 'organization' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_entity" ADD CONSTRAINT "github_entity_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_entity" ADD CONSTRAINT "github_entity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "github_entity" DROP COLUMN IF EXISTS "branch";