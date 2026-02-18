CREATE TABLE "system_deployment" (
	"system_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_deployment_system_id_deployment_id_pk" PRIMARY KEY("system_id","deployment_id")
);
--> statement-breakpoint
CREATE TABLE "system_environment" (
	"system_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_environment_system_id_environment_id_pk" PRIMARY KEY("system_id","environment_id")
);
--> statement-breakpoint
ALTER TABLE "system_deployment" ADD CONSTRAINT "system_deployment_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_deployment" ADD CONSTRAINT "system_deployment_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_environment" ADD CONSTRAINT "system_environment_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_environment" ADD CONSTRAINT "system_environment_environment_id_environment_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environment"("id") ON DELETE cascade ON UPDATE no action;