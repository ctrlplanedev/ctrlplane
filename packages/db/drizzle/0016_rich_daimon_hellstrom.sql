ALTER TABLE "runbook_variable" DROP CONSTRAINT "runbook_variable_runbook_id_runbook_id_fk";
--> statement-breakpoint
ALTER TABLE "runbook" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "runbook_variable" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runbook_variable" ADD CONSTRAINT "runbook_variable_runbook_id_runbook_id_fk" FOREIGN KEY ("runbook_id") REFERENCES "public"."runbook"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "runbook_variable" DROP COLUMN IF EXISTS "value";