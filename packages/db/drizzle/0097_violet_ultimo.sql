ALTER TYPE "public"."scope_type" ADD VALUE 'releaseTarget';--> statement-breakpoint
ALTER TABLE "resource_relationship_rule" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "workspace_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;