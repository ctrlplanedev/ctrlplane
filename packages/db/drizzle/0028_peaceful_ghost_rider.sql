ALTER TABLE "target_provider_google" ADD COLUMN "import_gke" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "target_provider_google" ADD COLUMN "import_namespaces" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "target_provider_google" ADD COLUMN "import_vcluster" boolean DEFAULT false NOT NULL;