CREATE TYPE "public"."job_verification_status" AS ENUM('failed', 'inconclusive', 'passed');--> statement-breakpoint
CREATE TYPE "public"."job_verification_trigger_on" AS ENUM('jobCreated', 'jobStarted', 'jobSuccess', 'jobFailure');--> statement-breakpoint
CREATE TABLE "job_verification_metric_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_verification_metric_status_id" uuid,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "job_verification_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_verification_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" jsonb NOT NULL,
	"interval_seconds" integer NOT NULL,
	"count" integer NOT NULL,
	"success_condition" text NOT NULL,
	"success_threshold" integer DEFAULT 0,
	"failure_condition" text DEFAULT 'false',
	"failure_threshold" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "policy_rule_job_verification_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_on" "job_verification_trigger_on" DEFAULT 'jobSuccess' NOT NULL,
	"policy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" jsonb NOT NULL,
	"interval_seconds" integer NOT NULL,
	"count" integer NOT NULL,
	"success_condition" text NOT NULL,
	"success_threshold" integer DEFAULT 0,
	"failure_condition" text DEFAULT 'false',
	"failure_threshold" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "trace_token" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "dispatch_context" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_verification_metric_measurement" ADD CONSTRAINT "job_verification_metric_measurement_job_verification_metric_status_id_job_verification_metric_id_fk" FOREIGN KEY ("job_verification_metric_status_id") REFERENCES "public"."job_verification_metric"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rule_job_verification_metric" ADD CONSTRAINT "policy_rule_job_verification_metric_policy_id_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id") ON DELETE cascade ON UPDATE no action;