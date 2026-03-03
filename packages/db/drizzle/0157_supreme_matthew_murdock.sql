CREATE TABLE "release_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"release_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_variable" DROP CONSTRAINT "release_variable_release_id_release_id_fk";
--> statement-breakpoint
ALTER TABLE "release_job" ADD CONSTRAINT "release_job_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_job" ADD CONSTRAINT "release_job_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_variable" ADD CONSTRAINT "release_variable_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;