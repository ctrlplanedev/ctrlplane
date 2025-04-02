CREATE TABLE IF NOT EXISTS "policy_deployment_version_selector" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deployment_version_selector" jsonb NOT NULL,
	CONSTRAINT "policy_deployment_version_selector_policy_id_unique" UNIQUE("policy_id")
);
--> statement-breakpoint
DROP TABLE "deployment_meta_dependency";--> statement-breakpoint
ALTER TABLE "resource_release" RENAME TO "release_target";--> statement-breakpoint
ALTER TABLE "release_target" DROP CONSTRAINT "resource_release_resource_id_resource_id_fk";
--> statement-breakpoint
ALTER TABLE "release_target" DROP CONSTRAINT "resource_release_environment_id_environment_id_fk";
--> statement-breakpoint
ALTER TABLE "release_target" DROP CONSTRAINT "resource_release_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "release_target" DROP CONSTRAINT "resource_release_desired_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_resource_id_resource_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_deployment_id_deployment_id_fk";
--> statement-breakpoint
ALTER TABLE "release" DROP CONSTRAINT "release_environment_id_environment_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "resource_release_resource_id_environment_id_deployment_id_index";--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "release_target_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_deployment_version_selector" ADD CONSTRAINT "policy_deployment_version_selector_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_target" ADD CONSTRAINT "release_target_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_target" ADD CONSTRAINT "release_target_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_target" ADD CONSTRAINT "release_target_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release_target" ADD CONSTRAINT "release_target_desired_release_id_release_id_fk" FOREIGN KEY ("desired_release_id") REFERENCES "public"."release"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "release" ADD CONSTRAINT "release_release_target_id_release_target_id_fk" FOREIGN KEY ("release_target_id") REFERENCES "public"."release_target"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "release_target_resource_id_environment_id_deployment_id_index" ON "release_target" USING btree ("resource_id","environment_id","deployment_id");--> statement-breakpoint
ALTER TABLE "release" DROP COLUMN IF EXISTS "resource_id";--> statement-breakpoint
ALTER TABLE "release" DROP COLUMN IF EXISTS "deployment_id";--> statement-breakpoint
ALTER TABLE "release" DROP COLUMN IF EXISTS "environment_id";