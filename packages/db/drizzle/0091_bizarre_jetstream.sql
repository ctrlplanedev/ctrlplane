CREATE TABLE "computed_policy_target_deployment" (
	"policy_target_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_target_deployment_policy_target_id_deployment_id_pk" PRIMARY KEY("policy_target_id","deployment_id")
);
--> statement-breakpoint
CREATE TABLE "computed_policy_target_environment" (
	"policy_target_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_target_environment_policy_target_id_environment_id_pk" PRIMARY KEY("policy_target_id","environment_id")
);
--> statement-breakpoint
CREATE TABLE "computed_policy_target_resource" (
	"policy_target_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_target_resource_policy_target_id_resource_id_pk" PRIMARY KEY("policy_target_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "computed_policy_target_deployment" ADD CONSTRAINT "computed_policy_target_deployment_policy_target_id_policy_target_id_fk" FOREIGN KEY ("policy_target_id") REFERENCES "public"."policy_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_target_deployment" ADD CONSTRAINT "computed_policy_target_deployment_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_target_environment" ADD CONSTRAINT "computed_policy_target_environment_policy_target_id_policy_target_id_fk" FOREIGN KEY ("policy_target_id") REFERENCES "public"."policy_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_target_environment" ADD CONSTRAINT "computed_policy_target_environment_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_target_resource" ADD CONSTRAINT "computed_policy_target_resource_policy_target_id_policy_target_id_fk" FOREIGN KEY ("policy_target_id") REFERENCES "public"."policy_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_target_resource" ADD CONSTRAINT "computed_policy_target_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;