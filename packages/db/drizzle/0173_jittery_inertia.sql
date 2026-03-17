DROP INDEX "reconcile_work_scope_kind_not_before_priority_event_ts_claimed_until_index";--> statement-breakpoint
CREATE INDEX "system_workspace_id_index" ON "system" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "reconcile_work_scope_unclaimed_idx" ON "reconcile_work_scope" USING btree ("kind","priority","event_ts","id") WHERE "reconcile_work_scope"."claimed_until" is null;--> statement-breakpoint
CREATE INDEX "computed_entity_relationship_from_idx" ON "computed_entity_relationship" USING btree ("from_entity_type","from_entity_id");--> statement-breakpoint
CREATE INDEX "computed_entity_relationship_to_idx" ON "computed_entity_relationship" USING btree ("to_entity_type","to_entity_id");