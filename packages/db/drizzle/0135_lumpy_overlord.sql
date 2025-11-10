CREATE TABLE "deployment_trace_span" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"name" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"workspace_id" uuid NOT NULL,
	"release_target_key" text,
	"release_id" text,
	"job_id" text,
	"parent_trace_id" text,
	"phase" text,
	"node_type" text,
	"status" text,
	"depth" integer,
	"sequence" integer,
	"attributes" jsonb,
	"events" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_trace_span" ADD CONSTRAINT "deployment_trace_span_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_trace_span_trace_span_idx" ON "deployment_trace_span" USING btree ("trace_id","span_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_trace_id_idx" ON "deployment_trace_span" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_parent_span_id_idx" ON "deployment_trace_span" USING btree ("parent_span_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_workspace_id_idx" ON "deployment_trace_span" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_release_target_key_idx" ON "deployment_trace_span" USING btree ("release_target_key");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_release_id_idx" ON "deployment_trace_span" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_job_id_idx" ON "deployment_trace_span" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_parent_trace_id_idx" ON "deployment_trace_span" USING btree ("parent_trace_id");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_created_at_idx" ON "deployment_trace_span" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_phase_idx" ON "deployment_trace_span" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_node_type_idx" ON "deployment_trace_span" USING btree ("node_type");--> statement-breakpoint
CREATE INDEX "deployment_trace_span_status_idx" ON "deployment_trace_span" USING btree ("status");