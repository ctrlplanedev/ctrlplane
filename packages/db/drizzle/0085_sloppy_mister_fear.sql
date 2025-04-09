CREATE TABLE IF NOT EXISTS "variable_set_release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variable_set_release_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variable_set_release_id" uuid NOT NULL,
	"variable_value_snapshot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variable_value_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"key" text NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "version_release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_target_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "release_variable";--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_release_target_id_release_target_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_version_id_deployment_version_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_variable_value" ADD COLUMN "sensitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "variable_set_value" ADD COLUMN "sensitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "version_release_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "variable_release_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_release" ADD CONSTRAINT "variable_set_release_release_target_id_release_target_id_fk" FOREIGN KEY ("release_target_id") REFERENCES "public"."release_target"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_release_value" ADD CONSTRAINT "variable_set_release_value_variable_set_release_id_variable_set_release_id_fk" FOREIGN KEY ("variable_set_release_id") REFERENCES "public"."variable_set_release"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_set_release_value" ADD CONSTRAINT "variable_set_release_value_variable_value_snapshot_id_variable_value_snapshot_id_fk" FOREIGN KEY ("variable_value_snapshot_id") REFERENCES "public"."variable_value_snapshot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variable_value_snapshot" ADD CONSTRAINT "variable_value_snapshot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "version_release" ADD CONSTRAINT "version_release_release_target_id_release_target_id_fk" FOREIGN KEY ("release_target_id") REFERENCES "public"."release_target"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "version_release" ADD CONSTRAINT "version_release_version_id_deployment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deployment_version"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variable_set_release_value_variable_set_release_id_variable_value_snapshot_id_index" ON "variable_set_release_value" USING btree ("variable_set_release_id","variable_value_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variable_value_snapshot_workspace_id_key_value_index" ON "variable_value_snapshot" USING btree ("workspace_id","key","value");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release" ADD CONSTRAINT "release_version_release_id_version_release_id_fk" FOREIGN KEY ("version_release_id") REFERENCES "public"."version_release"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release" ADD CONSTRAINT "release_variable_release_id_variable_set_release_id_fk" FOREIGN KEY ("variable_release_id") REFERENCES "public"."variable_set_release"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "release" DROP COLUMN IF EXISTS "release_target_id";--> statement-breakpoint
ALTER TABLE "release" DROP COLUMN IF EXISTS "version_id";--> statement-breakpoint
ALTER TABLE "release_job" DROP COLUMN IF EXISTS "created_at";