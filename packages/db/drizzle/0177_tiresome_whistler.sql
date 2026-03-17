DROP INDEX "computed_entity_relationship_from_idx";--> statement-breakpoint
DROP INDEX "computed_entity_relationship_to_idx";--> statement-breakpoint
CREATE INDEX "computed_policy_release_target_resource_id_environment_id_deployment_id_index" ON "computed_policy_release_target" USING btree ("resource_id","environment_id","deployment_id");--> statement-breakpoint
CREATE INDEX "computed_entity_relationship_from_idx" ON "computed_entity_relationship" USING btree ("from_entity_type","from_entity_id","rule_id","to_entity_type","to_entity_id");--> statement-breakpoint
CREATE INDEX "computed_entity_relationship_to_idx" ON "computed_entity_relationship" USING btree ("to_entity_type","to_entity_id","rule_id","from_entity_type","from_entity_id");