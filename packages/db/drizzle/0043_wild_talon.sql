CREATE TABLE IF NOT EXISTS "resource_provider_aws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_provider_id" uuid NOT NULL,
	"aws_role_arns" text[] NOT NULL,
	"import_eks" boolean DEFAULT false NOT NULL,
	"import_namespaces" boolean DEFAULT false NOT NULL,
	"import_vcluster" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "aws_role_arn" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_provider_aws" ADD CONSTRAINT "resource_provider_aws_resource_provider_id_resource_provider_id_fk" FOREIGN KEY ("resource_provider_id") REFERENCES "public"."resource_provider"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
