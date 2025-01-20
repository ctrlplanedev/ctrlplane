DROP TABLE IF EXISTS "environment_policy_approval";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environment_approval" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "environment_id" uuid NOT NULL,
    "release_id" uuid NOT NULL,
    "status" approval_status_type NOT NULL DEFAULT 'pending',
    "user_id" uuid,
    FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE CASCADE,
    FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_approval_environment_id_release_id_index" 
    ON "environment_approval" ("environment_id", "release_id");