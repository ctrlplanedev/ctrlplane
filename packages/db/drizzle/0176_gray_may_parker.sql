DROP INDEX "release_id_job_id_index";--> statement-breakpoint
CREATE INDEX "release_deployment_id_index" ON "release" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "release_job_job_id_index" ON "release_job" USING btree ("job_id");