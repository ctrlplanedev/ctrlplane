ALTER TABLE "job_variable" DROP CONSTRAINT "job_variable_job_id_job_id_fk";
--> statement-breakpoint
ALTER TABLE "job_variable" ADD CONSTRAINT "job_variable_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;