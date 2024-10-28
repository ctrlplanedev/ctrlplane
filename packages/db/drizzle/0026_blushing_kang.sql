CREATE TABLE IF NOT EXISTS "environment_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environment_policy_release_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environment_release_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "release_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"deployment_id" uuid NOT NULL,
	"release_filter" jsonb DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "environment_policy" RENAME COLUMN "duration" TO "rollout_duration";--> statement-breakpoint
ALTER TABLE "environment" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "environment_policy" ADD COLUMN "ephemeral_duration" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_metadata" ADD CONSTRAINT "environment_metadata_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_release_channel" ADD CONSTRAINT "environment_policy_release_channel_policy_id_environment_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."environment_policy"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_release_channel" ADD CONSTRAINT "environment_policy_release_channel_channel_id_release_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."release_channel"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_policy_release_channel" ADD CONSTRAINT "environment_policy_release_channel_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_release_channel" ADD CONSTRAINT "environment_release_channel_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_release_channel" ADD CONSTRAINT "environment_release_channel_channel_id_release_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."release_channel"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_release_channel" ADD CONSTRAINT "environment_release_channel_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_channel" ADD CONSTRAINT "release_channel_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_metadata_key_environment_id_index" ON "environment_metadata" USING btree ("key","environment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_policy_release_channel_policy_id_channel_id_index" ON "environment_policy_release_channel" USING btree ("policy_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_policy_release_channel_policy_id_deployment_id_index" ON "environment_policy_release_channel" USING btree ("policy_id","deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_release_channel_environment_id_channel_id_index" ON "environment_release_channel" USING btree ("environment_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environment_release_channel_environment_id_deployment_id_index" ON "environment_release_channel" USING btree ("environment_id","deployment_id");--> statement-breakpoint
ALTER TABLE "environment_policy" DROP COLUMN IF EXISTS "release_filter";