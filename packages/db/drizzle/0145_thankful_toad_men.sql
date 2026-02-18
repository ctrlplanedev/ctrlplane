CREATE TABLE "release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_variable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_version_id_deployment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deployment_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_variable" ADD CONSTRAINT "release_variable_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_variable_release_id_key_index" ON "release_variable" USING btree ("release_id","key");