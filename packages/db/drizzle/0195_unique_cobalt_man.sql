CREATE TYPE "public"."secret_provider_type" AS ENUM('aws_secrets_manager', 'doppler', 'env');--> statement-breakpoint
CREATE TABLE "secret_provider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "secret_provider_type" NOT NULL,
	"config" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "secret_provider" ADD CONSTRAINT "secret_provider_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "secret_provider_workspace_name_uniq" ON "secret_provider" USING btree ("workspace_id","name");