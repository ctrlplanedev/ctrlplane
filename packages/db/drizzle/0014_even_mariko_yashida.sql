packages/db/drizzle/0014_even_mariko_yashida.sqlCREATE TABLE IF NOT EXISTS "deployment_lock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid,
	"environment_id" uuid,
	"locked_at" timestamp DEFAULT '2024-10-15 03:14:45.221'
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_lock" ADD CONSTRAINT "deployment_lock_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_lock" ADD CONSTRAINT "deployment_lock_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_lock_deployment_id_environment_id_index" ON "deployment_lock" USING btree ("deployment_id","environment_id");