ALTER TABLE "workflow" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "workflow" SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'));--> statement-breakpoint
ALTER TABLE "workflow" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_workspace_id_slug_unique" UNIQUE("workspace_id","slug");
