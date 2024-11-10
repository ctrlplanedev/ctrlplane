CREATE TABLE IF NOT EXISTS "event" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "action" text NOT NULL,
    "payload" jsonb NOT NULL,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hook" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "action" text NOT NULL,
    "name" text NOT NULL,
    "scope_type" text NOT NULL,
    "scope_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runhook" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "hook_id" uuid NOT NULL,
    "runbook_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "hook_id" uuid NOT NULL,
    "url" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runhook" ADD CONSTRAINT "runhook_hook_id_hook_id_fk" FOREIGN KEY ("hook_id") REFERENCES "public"."hook"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runhook" ADD CONSTRAINT "runhook_runbook_id_runbook_id_fk" FOREIGN KEY ("runbook_id") REFERENCES "public"."runbook"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook" ADD CONSTRAINT "webhook_hook_id_hook_id_fk" FOREIGN KEY ("hook_id") REFERENCES "public"."hook"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;