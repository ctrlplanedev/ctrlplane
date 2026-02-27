ALTER TABLE "computed_deployment_resource" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "computed_deployment_resource" ADD COLUMN "last_evaluated_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "computed_environment_resource" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "computed_environment_resource" ADD COLUMN "last_evaluated_at" timestamp with time zone NOT NULL;