ALTER TABLE "environment_policy" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy" ADD CONSTRAINT "environment_policy_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Backfill default environment policies for each environment
INSERT INTO "environment_policy" ("name", "environment_id", "system_id")
SELECT 
    e."name" AS "name",
    e."id" AS "environment_id",
    e."system_id"
FROM "environment" e
WHERE e."id" NOT IN (
    SELECT "environment_id" FROM "environment_policy"
);--> statement-breakpoint