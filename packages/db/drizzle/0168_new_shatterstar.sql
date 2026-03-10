CREATE TABLE "computed_policy_release_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "computed_policy_release_target" ADD CONSTRAINT "computed_policy_release_target_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_release_target" ADD CONSTRAINT "computed_policy_release_target_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_release_target" ADD CONSTRAINT "computed_policy_release_target_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_release_target" ADD CONSTRAINT "computed_policy_release_target_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "computed_policy_release_target_policy_id_environment_id_deployment_id_resource_id_index" ON "computed_policy_release_target" USING btree ("policy_id","environment_id","deployment_id","resource_id");--> statement-breakpoint
CREATE INDEX "computed_policy_release_target_policy_id_index" ON "computed_policy_release_target" USING btree ("policy_id");