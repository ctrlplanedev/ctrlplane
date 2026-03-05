CREATE INDEX "deployment_variable_deployment_id_index" ON "deployment_variable" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "deployment_variable_value_deployment_variable_id_index" ON "deployment_variable_value" USING btree ("deployment_variable_id");--> statement-breakpoint
CREATE INDEX "deployment_workspace_id_index" ON "deployment" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "environment_workspace_id_index" ON "environment" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "resource_workspace_id_deleted_at_index" ON "resource" USING btree ("workspace_id","deleted_at");--> statement-breakpoint
CREATE INDEX "release_resource_id_environment_id_deployment_id_index" ON "release" USING btree ("resource_id","environment_id","deployment_id");--> statement-breakpoint
CREATE INDEX "release_id_job_id_index" ON "release_job" USING btree ("release_id","job_id");--> statement-breakpoint
CREATE INDEX "policy_workspace_id_index" ON "policy" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "job_verification_metric_measurement_job_verification_metric_status_id_index" ON "job_verification_metric_measurement" USING btree ("job_verification_metric_status_id");--> statement-breakpoint
CREATE INDEX "job_verification_metric_job_id_index" ON "job_verification_metric" USING btree ("job_id");