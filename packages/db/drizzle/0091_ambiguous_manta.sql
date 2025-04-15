CREATE TABLE "computed_policy_deployment" (
	"policy_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_deployment_policy_id_deployment_id_pk" PRIMARY KEY("policy_id","deployment_id")
);
--> statement-breakpoint
CREATE TABLE "computed_policy_environment" (
	"policy_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_environment_policy_id_environment_id_pk" PRIMARY KEY("policy_id","environment_id")
);
--> statement-breakpoint
CREATE TABLE "computed_policy_resource" (
	"policy_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "computed_policy_resource_policy_id_resource_id_pk" PRIMARY KEY("policy_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "computed_policy_deployment" ADD CONSTRAINT "computed_policy_deployment_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_deployment" ADD CONSTRAINT "computed_policy_deployment_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_environment" ADD CONSTRAINT "computed_policy_environment_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_environment" ADD CONSTRAINT "computed_policy_environment_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_resource" ADD CONSTRAINT "computed_policy_resource_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_policy_resource" ADD CONSTRAINT "computed_policy_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;