CREATE TABLE IF NOT EXISTS "azure_tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"tenant_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_provider_azure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_provider_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "azure_tenant" ADD CONSTRAINT "azure_tenant_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_provider_azure" ADD CONSTRAINT "resource_provider_azure_resource_provider_id_resource_provider_id_fk" FOREIGN KEY ("resource_provider_id") REFERENCES "public"."resource_provider"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_provider_azure" ADD CONSTRAINT "resource_provider_azure_tenant_id_azure_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."azure_tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "azure_tenant_tenant_id_index" ON "azure_tenant" USING btree ("tenant_id");