ALTER TABLE "environment_policy" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "environment_policy" ADD CONSTRAINT "environment_policy_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN null;
END $$;

-- Backfill default environment policies for each environment
INSERT INTO "environment_policy" ("name", "environment_id", "system_id")
SELECT 
  e."name" AS "name",
  e."id" AS "environment_id",
  e."system_id" AS "system_id"
FROM "environment" e
LEFT JOIN environment_policy ep ON e.id = ep.environment_id
WHERE ep.environment_id IS NULL;

UPDATE "environment"
SET "policy_id" = ep."id"
FROM "environment_policy" ep
WHERE "environment"."id" = ep."environment_id"
  AND "environment"."policy_id" IS NULL;

ALTER TABLE "environment" ALTER COLUMN "policy_id" SET NOT NULL;--> statement-breakpoint