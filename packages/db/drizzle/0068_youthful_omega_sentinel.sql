DO $$ BEGIN
 CREATE TYPE "public"."system_role" AS ENUM('user', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "system_role" "system_role" DEFAULT 'user' NOT NULL;