CREATE TYPE "public"."variable_scope" AS ENUM('resource', 'deployment', 'job_agent');--> statement-breakpoint
CREATE TYPE "public"."variable_value_kind" AS ENUM('literal', 'ref', 'secret_ref');--> statement-breakpoint
CREATE TABLE "variable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "variable_scope" NOT NULL,
	"resource_id" uuid,
	"deployment_id" uuid,
	"job_agent_id" uuid,
	"key" text NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variable_scope_target_check" CHECK (
        (
          "variable"."scope" = 'resource'
          and "variable"."resource_id" is not null
          and "variable"."deployment_id" is null
          and "variable"."job_agent_id" is null
        )
        or
        (
          "variable"."scope" = 'deployment'
          and "variable"."deployment_id" is not null
          and "variable"."resource_id" is null
          and "variable"."job_agent_id" is null
        )
        or
        (
          "variable"."scope" = 'job_agent'
          and "variable"."job_agent_id" is not null
          and "variable"."resource_id" is null
          and "variable"."deployment_id" is null
        )
      )
);
--> statement-breakpoint
CREATE TABLE "variable_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variable_id" uuid NOT NULL,
	"resource_selector" text,
	"priority" bigint DEFAULT 0 NOT NULL,
	"kind" "variable_value_kind" NOT NULL,
	"literal_value" jsonb,
	"ref_key" text,
	"ref_path" text[],
	"secret_provider" text,
	"secret_key" text,
	"secret_path" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variable_value_kind_shape_check" CHECK (
        (
          "variable_value"."kind" = 'literal'
          and "variable_value"."literal_value" is not null
          and "variable_value"."ref_key" is null
          and "variable_value"."ref_path" is null
          and "variable_value"."secret_provider" is null
          and "variable_value"."secret_key" is null
          and "variable_value"."secret_path" is null
        )
        or
        (
          "variable_value"."kind" = 'ref'
          and "variable_value"."literal_value" is null
          and "variable_value"."ref_key" is not null
          and "variable_value"."secret_provider" is null
          and "variable_value"."secret_key" is null
          and "variable_value"."secret_path" is null
        )
        or
        (
          "variable_value"."kind" = 'secret_ref'
          and "variable_value"."literal_value" is null
          and "variable_value"."ref_key" is null
          and "variable_value"."ref_path" is null
          and "variable_value"."secret_provider" is not null
          and "variable_value"."secret_key" is not null
        )
      )
);
--> statement-breakpoint
ALTER TABLE "variable" ADD CONSTRAINT "variable_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variable" ADD CONSTRAINT "variable_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variable" ADD CONSTRAINT "variable_job_agent_id_job_agent_id_fk" FOREIGN KEY ("job_agent_id") REFERENCES "public"."job_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variable_value" ADD CONSTRAINT "variable_value_variable_id_variable_id_fk" FOREIGN KEY ("variable_id") REFERENCES "public"."variable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "variable_resource_key_uniq" ON "variable" USING btree ("resource_id","key") WHERE "variable"."resource_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "variable_deployment_key_uniq" ON "variable" USING btree ("deployment_id","key") WHERE "variable"."deployment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "variable_job_agent_key_uniq" ON "variable" USING btree ("job_agent_id","key") WHERE "variable"."job_agent_id" is not null;--> statement-breakpoint
CREATE INDEX "variable_scope_idx" ON "variable" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "variable_value_variable_priority_idx" ON "variable_value" USING btree ("variable_id","priority","id");--> statement-breakpoint
CREATE INDEX "variable_value_kind_idx" ON "variable_value" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "variable_value_resolution_uniq" ON "variable_value" USING btree ("variable_id",coalesce("resource_selector", ''),"priority");