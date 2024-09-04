ALTER TABLE "target" DROP CONSTRAINT "target_provider_id_target_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "target_provider_google" DROP CONSTRAINT "target_provider_google_target_provider_id_target_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "target" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target" ADD CONSTRAINT "target_provider_id_target_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."target_provider"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_provider_google" ADD CONSTRAINT "target_provider_google_target_provider_id_target_provider_id_fk" FOREIGN KEY ("target_provider_id") REFERENCES "public"."target_provider"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
