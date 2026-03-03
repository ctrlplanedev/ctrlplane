CREATE TABLE "policy_skip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"environment_id" uuid,
	"expires_at" timestamp with time zone,
	"reason" text DEFAULT '' NOT NULL,
	"resource_id" uuid,
	"rule_id" uuid NOT NULL,
	"version_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policy_skip" ADD CONSTRAINT "policy_skip_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint