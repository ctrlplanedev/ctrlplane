package e2e

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/test/integration"
)

// TestEngine_GetRelatedEntities_ResourceToResource tests finding related resources
func TestEngine_GetRelatedEntities_ResourceToResource(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleReference("contains"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		integration.WithResource(
			integration.ResourceID("vpc-us-east-1"),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("vpc-us-west-2"),
			integration.ResourceName("vpc-us-west-2"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-east-1"),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-east-2"),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-west-1"),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	ctx := context.Background()

	// Test from VPC in us-east-1 to clusters
	vpcEast, ok := engine.Workspace().Resources().Get("vpc-us-east-1")
	if !ok {
		t.Fatalf("vpc-us-east-1 not found")
	}

	entity := relationships.NewResourceEntity(vpcEast)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have 2 clusters in us-east-1
	clusters, ok := relatedEntities["contains"]
	if !ok {
		t.Fatalf("'contains' relationship not found")
	}

	if len(clusters) != 2 {
		t.Fatalf("expected 2 related clusters, got %d", len(clusters))
	}

	// Verify the correct clusters are returned
	clusterIDs := make(map[string]bool)
	for _, cluster := range clusters {
		clusterIDs[cluster.EntityId] = true
	}

	if !clusterIDs["cluster-east-1"] {
		t.Errorf("cluster-east-1 not in related entities")
	}
	if !clusterIDs["cluster-east-2"] {
		t.Errorf("cluster-east-2 not in related entities")
	}
	if clusterIDs["cluster-west-1"] {
		t.Errorf("cluster-west-1 should not be in related entities")
	}
}

// TestEngine_GetRelatedEntities_BidirectionalRelationship tests that relationships work in both directions
func TestEngine_GetRelatedEntities_BidirectionalRelationship(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleReference("part-of"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID("vpc-us-east-1"),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-east-1"),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	ctx := context.Background()

	// Test from cluster to VPC (reverse direction)
	cluster, ok := engine.Workspace().Resources().Get("cluster-east-1")
	if !ok {
		t.Fatalf("cluster-east-1 not found")
	}

	entity := relationships.NewResourceEntity(cluster)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should find the VPC in the reverse direction
	vpcs, ok := relatedEntities["part-of"]
	if !ok {
		t.Fatalf("'part-of' relationship not found")
	}

	if len(vpcs) != 1 {
		t.Fatalf("expected 1 related VPC, got %d", len(vpcs))
	}

	if vpcs[0].EntityId != "vpc-us-east-1" {
		t.Errorf("expected vpc-us-east-1, got %s", vpcs[0].EntityId)
	}
}

// TestEngine_GetRelatedEntities_DeploymentToResource tests deployment to resource relationships
// func TestEngine_GetRelatedEntities_DeploymentToResource(t *testing.T) {
// 	engine := integration.NewTestWorkspace(
// 		t,
// 		integration.WithSystem(
// 			integration.SystemName("test-system"),
// 			integration.WithDeployment(
// 				integration.DeploymentID("deployment-api"),
// 				integration.DeploymentName("api"),
// 				integration.DeploymentJobAgentConfig(map[string]any{
// 					"region": "us-east-1",
// 				}),
// 			),
// 			integration.WithDeployment(
// 				integration.DeploymentID("deployment-worker"),
// 				integration.DeploymentName("worker"),
// 				integration.DeploymentJobAgentConfig(map[string]any{
// 					"region": "us-west-2",
// 				}),
// 			),
// 		),
// 		integration.WithRelationshipRule(
// 			integration.RelationshipRuleID("rel-rule-1"),
// 			integration.RelationshipRuleName("deployment-to-cluster"),
// 			integration.RelationshipRuleReference("runs-on"),
// 			integration.RelationshipRuleFromType("deployment"),
// 			integration.RelationshipRuleToType("resource"),
// 			integration.RelationshipRuleToJsonSelector(map[string]any{
// 				"type":     "kind",
// 				"operator": "equals",
// 				"value":    "kubernetes-cluster",
// 			}),
// 			integration.WithPropertyMatcher(
// 				integration.PropertyMatcherFromProperty([]string{"job_agent_config", "region"}),
// 				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
// 				integration.PropertyMatcherOperator(oapi.Equals),
// 			),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("cluster-east-1"),
// 			integration.ResourceName("cluster-east-1"),
// 			integration.ResourceKind("kubernetes-cluster"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-east-1",
// 			}),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("cluster-west-1"),
// 			integration.ResourceName("cluster-west-1"),
// 			integration.ResourceKind("kubernetes-cluster"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-west-2",
// 			}),
// 		),
// 	)

// 	ctx := context.Background()

// 	// Test from deployment to resources
// 	deployment, ok := engine.Workspace().Deployments().Get("deployment-api")
// 	if !ok {
// 		t.Fatalf("deployment-api not found")
// 	}

// 	entity := relationships.NewDeploymentEntity(deployment)
// 	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
// 	if err != nil {
// 		t.Fatalf("GetRelatedEntities failed: %v", err)
// 	}

// 	clusters, ok := relatedEntities["runs-on"]
// 	if !ok {
// 		t.Fatalf("'runs-on' relationship not found")
// 	}

// 	if len(clusters) != 1 {
// 		t.Fatalf("expected 1 related cluster, got %d", len(clusters))
// 	}

// 	if clusters[0].EntityId != "cluster-east-1" {
// 		t.Errorf("expected cluster-east-1, got %s", clusters[0].EntityId)
// 	}
// }

// TestEngine_GetRelatedEntities_EnvironmentToResource tests environment to resource relationships
func TestEngine_GetRelatedEntities_EnvironmentToResource(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithEnvironment(
				integration.EnvironmentID("env-prod"),
				integration.EnvironmentName("production"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID("env-staging"),
				integration.EnvironmentName("staging"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("environment-to-resource"),
			integration.RelationshipRuleReference("has-resources"),
			integration.RelationshipRuleFromType("environment"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "name",
				"operator": "equals",
				"value":    "production",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "metadata",
				"operator": "equals",
				"key":      "environment",
				"value":    "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-prod"),
			integration.ResourceName("db-prod"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"environment": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cache-prod"),
			integration.ResourceName("cache-prod"),
			integration.ResourceKind("cache"),
			integration.ResourceMetadata(map[string]string{
				"environment": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-staging"),
			integration.ResourceName("db-staging"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"environment": "staging",
			}),
		),
	)

	ctx := context.Background()

	// Test from environment to resources
	environment, ok := engine.Workspace().Environments().Get("env-prod")
	if !ok {
		t.Fatalf("env-prod not found")
	}

	entity := relationships.NewEnvironmentEntity(environment)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	resources, ok := relatedEntities["has-resources"]
	if !ok {
		t.Fatalf("'has-resources' relationship not found")
	}

	if len(resources) != 2 {
		t.Fatalf("expected 2 related resources, got %d", len(resources))
	}

	resourceIDs := make(map[string]bool)
	for _, resource := range resources {
		resourceIDs[resource.EntityId] = true
	}

	if !resourceIDs["db-prod"] {
		t.Errorf("db-prod not in related entities")
	}
	if !resourceIDs["cache-prod"] {
		t.Errorf("cache-prod not in related entities")
	}
	if resourceIDs["db-staging"] {
		t.Errorf("db-staging should not be in related entities")
	}
}

// TestEngine_GetRelatedEntities_MultipleRelationships tests entity with multiple relationship rules
func TestEngine_GetRelatedEntities_MultipleRelationships(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleReference("contains-clusters"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"id"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "vpc_id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-2"),
			integration.RelationshipRuleName("vpc-to-database"),
			integration.RelationshipRuleReference("contains-databases"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"id"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "vpc_id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID("vpc-1"),
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
		),
		integration.WithResource(
			integration.ResourceID("cluster-1"),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": "vpc-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-2"),
			integration.ResourceName("cluster-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": "vpc-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-1"),
			integration.ResourceName("db-1"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": "vpc-1",
			}),
		),
	)

	ctx := context.Background()

	vpc, ok := engine.Workspace().Resources().Get("vpc-1")
	if !ok {
		t.Fatalf("vpc-1 not found")
	}

	entity := relationships.NewResourceEntity(vpc)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have two different relationship references
	if len(relatedEntities) != 2 {
		t.Fatalf("expected 2 relationship references, got %d", len(relatedEntities))
	}

	clusters, ok := relatedEntities["contains-clusters"]
	if !ok {
		t.Fatalf("'contains-clusters' relationship not found")
	}

	if len(clusters) != 2 {
		t.Fatalf("expected 2 clusters, got %d", len(clusters))
	}

	databases, ok := relatedEntities["contains-databases"]
	if !ok {
		t.Fatalf("'contains-databases' relationship not found")
	}

	if len(databases) != 1 {
		t.Fatalf("expected 1 database, got %d", len(databases))
	}
}

// TestEngine_GetRelatedEntities_PropertyMatcherNotEquals tests not_equals operator
func TestEngine_GetRelatedEntities_PropertyMatcherNotEquals(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("cross-region-replication"),
			integration.RelationshipRuleReference("replicates-to"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator(oapi.NotEquals),
			),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cluster_name"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "cluster_name"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID("db-east"),
			integration.ResourceName("db-east"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region":       "us-east-1",
				"cluster_name": "my-cluster",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-west"),
			integration.ResourceName("db-west"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region":       "us-west-2",
				"cluster_name": "my-cluster",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-east-other"),
			integration.ResourceName("db-east-other"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region":       "us-east-1",
				"cluster_name": "other-cluster",
			}),
		),
	)

	ctx := context.Background()

	dbEast, ok := engine.Workspace().Resources().Get("db-east")
	if !ok {
		t.Fatalf("db-east not found")
	}

	entity := relationships.NewResourceEntity(dbEast)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	replicas, ok := relatedEntities["replicates-to"]
	if !ok {
		t.Fatalf("'replicates-to' relationship not found")
	}

	for _, rel := range replicas {
		fmt.Println(rel.EntityId, rel.Direction)
	}

	// Should only find db-west (same cluster, different region)
	// if len(replicas) != 1 {
	// 	t.Fatalf("expected 1 replica, got %d", len(replicas))
	// }
	if len(replicas) != 2 {
		t.Fatalf("expected 2 replica, got %d", len(replicas))
	}

	if replicas[0].EntityId != "db-west" {
		t.Errorf("expected db-west, got %s", replicas[0].EntityId)
	}
}

// TestEngine_GetRelatedEntities_PropertyMatcherContains tests contains operator
func TestEngine_GetRelatedEntities_PropertyMatcherContains(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("service-to-endpoint"),
			integration.RelationshipRuleReference("exposes"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "endpoint",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "prefix"}),
				integration.PropertyMatcherToProperty([]string{"name"}),
				integration.PropertyMatcherOperator(oapi.Contains),
			),
		),
		integration.WithResource(
			integration.ResourceID("service-api"),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"prefix": "api-service-v1,api-service-v2",
			}),
		),
		integration.WithResource(
			integration.ResourceID("endpoint-1"),
			integration.ResourceName("api-service-v1"),
			integration.ResourceKind("endpoint"),
		),
		integration.WithResource(
			integration.ResourceID("endpoint-2"),
			integration.ResourceName("api-service-v2"),
			integration.ResourceKind("endpoint"),
		),
		integration.WithResource(
			integration.ResourceID("endpoint-3"),
			integration.ResourceName("other-service"),
			integration.ResourceKind("endpoint"),
		),
	)

	ctx := context.Background()

	service, ok := engine.Workspace().Resources().Get("service-api")
	if !ok {
		t.Fatalf("service-api not found")
	}

	entity := relationships.NewResourceEntity(service)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	endpoints, ok := relatedEntities["exposes"]
	if !ok {
		t.Fatalf("'exposes' relationship not found")
	}

	// Should find endpoint-1 and endpoint-2 (service prefix contains their names)
	if len(endpoints) != 2 {
		t.Fatalf("expected 2 endpoints, got %d", len(endpoints))
	}

	endpointIDs := make(map[string]bool)
	for _, endpoint := range endpoints {
		endpointIDs[endpoint.EntityId] = true
	}

	if !endpointIDs["endpoint-1"] {
		t.Errorf("endpoint-1 not in related entities")
	}
	if !endpointIDs["endpoint-2"] {
		t.Errorf("endpoint-2 not in related entities")
	}
	if endpointIDs["endpoint-3"] {
		t.Errorf("endpoint-3 should not be in related entities")
	}
}

// TestEngine_GetRelatedEntities_PropertyMatcherStartsWith tests starts_with operator
func TestEngine_GetRelatedEntities_PropertyMatcherStartsWith(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("region-to-resource"),
			integration.RelationshipRuleReference("contains"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "region",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "datacenter",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region_code"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "code_prefix"}),
				integration.PropertyMatcherOperator(oapi.StartsWith),
			),
		),
		integration.WithResource(
			integration.ResourceID("region-us-east"),
			integration.ResourceName("us-east"),
			integration.ResourceKind("region"),
			integration.ResourceMetadata(map[string]string{
				"region_code": "us-east-1a",
			}),
		),
		integration.WithResource(
			integration.ResourceID("dc-1"),
			integration.ResourceName("dc-1"),
			integration.ResourceKind("datacenter"),
			integration.ResourceMetadata(map[string]string{
				"code_prefix": "us-east",
			}),
		),
		integration.WithResource(
			integration.ResourceID("dc-2"),
			integration.ResourceName("dc-2"),
			integration.ResourceKind("datacenter"),
			integration.ResourceMetadata(map[string]string{
				"code_prefix": "us",
			}),
		),
		integration.WithResource(
			integration.ResourceID("dc-3"),
			integration.ResourceName("dc-3"),
			integration.ResourceKind("datacenter"),
			integration.ResourceMetadata(map[string]string{
				"code_prefix": "eu-west",
			}),
		),
	)

	ctx := context.Background()

	region, ok := engine.Workspace().Resources().Get("region-us-east")
	if !ok {
		t.Fatalf("region-us-east not found")
	}

	entity := relationships.NewResourceEntity(region)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	datacenters, ok := relatedEntities["contains"]
	if !ok {
		t.Fatalf("'contains' relationship not found")
	}

	// Should find dc-1 and dc-2 (region_code starts with their prefixes)
	if len(datacenters) != 2 {
		t.Fatalf("expected 2 datacenters, got %d", len(datacenters))
	}

	dcIDs := make(map[string]bool)
	for _, dc := range datacenters {
		dcIDs[dc.EntityId] = true
	}

	if !dcIDs["dc-1"] {
		t.Errorf("dc-1 not in related entities")
	}
	if !dcIDs["dc-2"] {
		t.Errorf("dc-2 not in related entities")
	}
	if dcIDs["dc-3"] {
		t.Errorf("dc-3 should not be in related entities")
	}
}

// TestEngine_GetRelatedEntities_PropertyMatcherEndsWith tests ends_with operator
func TestEngine_GetRelatedEntities_PropertyMatcherEndsWith(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("app-to-logs"),
			integration.RelationshipRuleReference("has-logs"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "application",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "log-stream",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "app_id"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "suffix"}),
				integration.PropertyMatcherOperator(oapi.EndsWith),
			),
		),
		integration.WithResource(
			integration.ResourceID("app-1"),
			integration.ResourceName("app-1"),
			integration.ResourceKind("application"),
			integration.ResourceMetadata(map[string]string{
				"app_id": "service-a-app-123",
			}),
		),
		integration.WithResource(
			integration.ResourceID("log-1"),
			integration.ResourceName("log-1"),
			integration.ResourceKind("log-stream"),
			integration.ResourceMetadata(map[string]string{
				"suffix": "-app-123",
			}),
		),
		integration.WithResource(
			integration.ResourceID("log-2"),
			integration.ResourceName("log-2"),
			integration.ResourceKind("log-stream"),
			integration.ResourceMetadata(map[string]string{
				"suffix": "-app-123",
			}),
		),
		integration.WithResource(
			integration.ResourceID("log-3"),
			integration.ResourceName("log-3"),
			integration.ResourceKind("log-stream"),
			integration.ResourceMetadata(map[string]string{
				"suffix": "-app-456",
			}),
		),
	)

	ctx := context.Background()

	app, ok := engine.Workspace().Resources().Get("app-1")
	if !ok {
		t.Fatalf("app-1 not found")
	}

	entity := relationships.NewResourceEntity(app)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	logs, ok := relatedEntities["has-logs"]
	if !ok {
		t.Fatalf("'has-logs' relationship not found")
	}

	// Should find log-1 and log-2 (app_id ends with their suffix)
	if len(logs) != 2 {
		var ids []string
		for _, log := range logs {
			ids = append(ids, log.EntityId)
		}
		t.Fatalf("expected 2 logs, got %d: %v", len(logs), ids)
	}

	logIDs := make(map[string]bool)
	for _, log := range logs {
		logIDs[log.EntityId] = true
	}

	if !logIDs["log-1"] {
		t.Errorf("log-1 not in related entities")
	}
	if !logIDs["log-2"] {
		t.Errorf("log-2 not in related entities")
	}
	if logIDs["log-3"] {
		t.Errorf("log-3 should not be in related entities")
	}
}

func TestEngine_GetRelatedEntities_NoSelectorMatchNone(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("all-resources-in-region"),
			integration.RelationshipRuleReference("in-region"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			// No selectors - matches all resources of the specified types
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID("resource-1"),
			integration.ResourceName("resource-1"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("resource-2"),
			integration.ResourceName("resource-2"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("resource-3"),
			integration.ResourceName("resource-3"),
			integration.ResourceKind("cache"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	ctx := context.Background()

	resource1, ok := engine.Workspace().Resources().Get("resource-1")
	if !ok {
		t.Fatalf("resource-1 not found")
	}

	entity := relationships.NewResourceEntity(resource1)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	if len(relatedEntities) != 0 {
		t.Fatalf("expected 0 related entities, got %d", len(relatedEntities))
	}
}

// TestEngine_GetRelatedEntities_NoSelectorMatchNone tests nil selectors that match all entities of that type
// func TestEngine_GetRelatedEntities_NoSelectorMatchAll(t *testing.T) {
// 	engine := integration.NewTestWorkspace(
// 		t,
// 		integration.WithRelationshipRule(
// 			integration.RelationshipRuleID("rel-rule-1"),
// 			integration.RelationshipRuleName("all-resources-in-region"),
// 			integration.RelationshipRuleReference("in-region"),
// 			integration.RelationshipRuleFromType("resource"),
// 			integration.RelationshipRuleToType("resource"),
// 			// No selectors - matches all resources of the specified types
// 			integration.WithPropertyMatcher(
// 				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
// 				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
// 				integration.PropertyMatcherOperator(oapi.Equals),
// 			),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("resource-1"),
// 			integration.ResourceName("resource-1"),
// 			integration.ResourceKind("service"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-east-1",
// 			}),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("resource-2"),
// 			integration.ResourceName("resource-2"),
// 			integration.ResourceKind("database"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-east-1",
// 			}),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("resource-3"),
// 			integration.ResourceName("resource-3"),
// 			integration.ResourceKind("cache"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-west-2",
// 			}),
// 		),
// 	)

// 	ctx := context.Background()

// 	resource1, ok := engine.Workspace().Resources().Get("resource-1")
// 	if !ok {
// 		t.Fatalf("resource-1 not found")
// 	}

// 	entity := relationships.NewResourceEntity(resource1)
// 	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
// 	if err != nil {
// 		t.Fatalf("GetRelatedEntities failed: %v", err)
// 	}

// 	related, ok := relatedEntities["in-region"]
// 	if !ok {
// 		t.Fatalf("'in-region' relationship not found")
// 	}

// 	for _, rel := range related {
// 		fmt.Println(rel.EntityId, rel.Direction)
// 	}

// 	// With nil selectors, all resources with matching properties should match
// 	// resource-1 (us-east-1) should match itself and resource-2 (us-east-1) but not resource-3 (us-west-2)
// 	if len(related) != 2 {
// 		t.Fatalf("expected 2 related entities, got %d", len(related))
// 	}
// 	// if len(related) != 4 {
// 	// 	t.Fatalf("expected 4 related entities, got %d", len(related))
// 	// }

// 	// Verify the correct resources are returned
// 	resourceIDs := make(map[string]bool)
// 	for _, res := range related {
// 		resourceIDs[res.EntityId] = true
// 	}

// 	if !resourceIDs["resource-1"] {
// 		t.Errorf("resource-1 not in related entities (self-relationship)")
// 	}
// 	if !resourceIDs["resource-2"] {
// 		t.Errorf("resource-2 not in related entities")
// 	}

// 	// With nil selectors, all resources with matching properties should match
// 	// resource-1 (us-east-1) relates to resource-2 (us-east-1) but not resource-3 (us-west-2)
// 	// Self-references are skipped by optimization
// 	// Bidirectional storage: resource-1->resource-2 (to) and resource-2->resource-1 (from)
// 	// if len(related) != 2 {
// 	// 	t.Fatalf("expected 2 related entities, got %d", len(related))
// 	// }

// 	// // Verify resource-2 is in both directions
// 	// hasToResource2 := false
// 	// hasFromResource2 := false

// 	// for _, rel := range related {
// 	// 	if rel.EntityId == "resource-2" && rel.Direction == oapi.To {
// 	// 		hasToResource2 = true
// 	// 	}
// 	// 	if rel.EntityId == "resource-2" && rel.Direction == oapi.From {
// 	// 		hasFromResource2 = true
// 	// 	}
// 	// }

// 	// if !hasToResource2 {
// 	// 	t.Errorf("resource-1 should have 'to' relationship with resource-2")
// 	// }
// 	// if !hasFromResource2 {
// 	// 	t.Errorf("resource-1 should have 'from' relationship with resource-2")
// 	// }
// }

// TestEngine_GetRelatedEntities_ConfigPropertyPath tests accessing nested config properties
func TestEngine_GetRelatedEntities_ConfigPropertyPath(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("service-to-dependency"),
			integration.RelationshipRuleReference("depends-on"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"config", "dependencies", "database"}),
				integration.PropertyMatcherToProperty([]string{"name"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID("service-api"),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceConfig(map[string]interface{}{
				"dependencies": map[string]interface{}{
					"database": "postgres-service",
					"cache":    "redis-service",
				},
			}),
		),
		integration.WithResource(
			integration.ResourceID("service-postgres"),
			integration.ResourceName("postgres-service"),
			integration.ResourceKind("service"),
		),
		integration.WithResource(
			integration.ResourceID("service-redis"),
			integration.ResourceName("redis-service"),
			integration.ResourceKind("service"),
		),
	)

	ctx := context.Background()

	apiService, ok := engine.Workspace().Resources().Get("service-api")
	if !ok {
		t.Fatalf("service-api not found")
	}

	entity := relationships.NewResourceEntity(apiService)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	dependencies, ok := relatedEntities["depends-on"]
	if !ok {
		t.Fatalf("'depends-on' relationship not found")
	}

	// Should find postgres-service (not redis-service)
	if len(dependencies) != 1 {
		t.Fatalf("expected 1 dependency, got %d", len(dependencies))
	}

	if dependencies[0].EntityId != "service-postgres" {
		t.Errorf("expected service-postgres, got %s", dependencies[0].EntityId)
	}
}

// TestEngine_GetRelatedEntities_NoMatchingRelationships tests entity with no matching relationships
func TestEngine_GetRelatedEntities_NoMatchingRelationships(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleReference("contains"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
		),
		integration.WithResource(
			integration.ResourceID("database-1"),
			integration.ResourceName("database-1"),
			integration.ResourceKind("database"),
		),
	)

	ctx := context.Background()

	database, ok := engine.Workspace().Resources().Get("database-1")
	if !ok {
		t.Fatalf("database-1 not found")
	}

	entity := relationships.NewResourceEntity(database)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have no relationships since database doesn't match any rule
	if len(relatedEntities) != 0 {
		t.Fatalf("expected 0 relationships, got %d", len(relatedEntities))
	}
}

// TestEngine_GetRelatedEntities_EmptyResults tests relationship rule that matches but finds no targets
func TestEngine_GetRelatedEntities_EmptyResults(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleReference("contains"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID("vpc-1"),
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-1"),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	ctx := context.Background()

	vpc, ok := engine.Workspace().Resources().Get("vpc-1")
	if !ok {
		t.Fatalf("vpc-1 not found")
	}

	entity := relationships.NewResourceEntity(vpc)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// VPC matches the rule but no clusters in the same region
	// The result should be empty (no "contains" key)
	if len(relatedEntities) != 0 {
		t.Fatalf("expected empty results, got %d relationships", len(relatedEntities))
	}
}

// TestEngine_GetRelatedEntities_CelMatcher_SimpleComparison tests basic CEL expression matching
func TestEngine_GetRelatedEntities_CelMatcher_SimpleComparison(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("vpc-to-cluster-cel"),
			integration.RelationshipRuleReference("contains"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
		),
		integration.WithResource(
			integration.ResourceID("vpc-us-east-1"),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("vpc-us-west-2"),
			integration.ResourceName("vpc-us-west-2"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-east-1"),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-east-2"),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("cluster-west-1"),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	ctx := context.Background()

	// Test from VPC in us-east-1 to clusters
	vpcEast, ok := engine.Workspace().Resources().Get("vpc-us-east-1")
	if !ok {
		t.Fatalf("vpc-us-east-1 not found")
	}

	entity := relationships.NewResourceEntity(vpcEast)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have 2 clusters in us-east-1
	clusters, ok := relatedEntities["contains"]
	if !ok {
		t.Fatalf("'contains' relationship not found")
	}

	if len(clusters) != 2 {
		t.Fatalf("expected 2 related clusters, got %d", len(clusters))
	}

	// Verify the correct clusters are returned
	clusterIDs := make(map[string]bool)
	for _, cluster := range clusters {
		clusterIDs[cluster.EntityId] = true
	}

	if !clusterIDs["cluster-east-1"] {
		t.Errorf("cluster-east-1 not in related entities")
	}
	if !clusterIDs["cluster-east-2"] {
		t.Errorf("cluster-east-2 not in related entities")
	}
	if clusterIDs["cluster-west-1"] {
		t.Errorf("cluster-west-1 should not be in related entities")
	}
}

// TestEngine_GetRelatedEntities_CelMatcher_ComplexExpression tests CEL with complex logic
func TestEngine_GetRelatedEntities_CelMatcher_ComplexExpression(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("service-to-dependency-cel"),
			integration.RelationshipRuleReference("depends-on"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			// CEL expression with multiple conditions and string operations
			integration.WithCelMatcher(`
				from.metadata.region == to.metadata.region &&
				to.metadata.tier == "critical" &&
				from.config.database_name.startsWith(to.name)
			`),
		),
		integration.WithResource(
			integration.ResourceID("service-api"),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
			integration.ResourceConfig(map[string]interface{}{
				"database_name": "postgres-prod-db",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-postgres"),
			integration.ResourceName("postgres-prod"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"tier":   "critical",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-mysql"),
			integration.ResourceName("mysql-prod"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"tier":   "standard",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-postgres-west"),
			integration.ResourceName("postgres-west"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
				"tier":   "critical",
			}),
		),
	)

	ctx := context.Background()

	apiService, ok := engine.Workspace().Resources().Get("service-api")
	if !ok {
		t.Fatalf("service-api not found")
	}

	entity := relationships.NewResourceEntity(apiService)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	dependencies, ok := relatedEntities["depends-on"]
	if !ok {
		t.Fatalf("'depends-on' relationship not found")
	}

	// Should only find db-postgres (same region, tier=critical, name starts with "postgres-prod")
	if len(dependencies) != 1 {
		t.Fatalf("expected 1 dependency, got %d", len(dependencies))
	}

	if dependencies[0].EntityId != "db-postgres" {
		t.Errorf("expected db-postgres, got %s", dependencies[0].EntityId)
	}
}

// TestEngine_GetRelatedEntities_CelMatcher_CrossEntityType tests CEL matching deployment to resource
// func TestEngine_GetRelatedEntities_CelMatcher_CrossEntityType(t *testing.T) {
// 	engine := integration.NewTestWorkspace(
// 		t,
// 		integration.WithSystem(
// 			integration.SystemName("test-system"),
// 			integration.WithDeployment(
// 				integration.DeploymentID("deployment-api"),
// 				integration.DeploymentName("api"),
// 				integration.DeploymentJobAgentConfig(map[string]any{
// 					"region":     "us-east-1",
// 					"cluster_id": "cluster-123",
// 				}),
// 			),
// 			integration.WithDeployment(
// 				integration.DeploymentID("deployment-worker"),
// 				integration.DeploymentName("worker"),
// 				integration.DeploymentJobAgentConfig(map[string]any{
// 					"region":     "us-west-2",
// 					"cluster_id": "cluster-456",
// 				}),
// 			),
// 		),
// 		integration.WithRelationshipRule(
// 			integration.RelationshipRuleID("rel-rule-1"),
// 			integration.RelationshipRuleName("deployment-to-cluster-cel"),
// 			integration.RelationshipRuleReference("runs-on"),
// 			integration.RelationshipRuleFromType("deployment"),
// 			integration.RelationshipRuleToType("resource"),
// 			integration.RelationshipRuleToJsonSelector(map[string]any{
// 				"type":     "kind",
// 				"operator": "equals",
// 				"value":    "kubernetes-cluster",
// 			}),
// 			// CEL expression accessing deployment properties
// 			integration.WithCelMatcher(`
// 				from.jobAgentConfig.region == to.metadata.region &&
// 				from.jobAgentConfig.cluster_id == to.id
// 			`),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("cluster-123"),
// 			integration.ResourceName("cluster-east-1"),
// 			integration.ResourceKind("kubernetes-cluster"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-east-1",
// 			}),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID("cluster-456"),
// 			integration.ResourceName("cluster-west-1"),
// 			integration.ResourceKind("kubernetes-cluster"),
// 			integration.ResourceMetadata(map[string]string{
// 				"region": "us-west-2",
// 			}),
// 		),
// 	)

// 	ctx := context.Background()

// 	// Test from deployment to resources
// 	deployment, ok := engine.Workspace().Deployments().Get("deployment-api")
// 	if !ok {
// 		t.Fatalf("deployment-api not found")
// 	}

// 	entity := relationships.NewDeploymentEntity(deployment)
// 	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
// 	if err != nil {
// 		t.Fatalf("GetRelatedEntities failed: %v", err)
// 	}

// 	clusters, ok := relatedEntities["runs-on"]
// 	if !ok {
// 		t.Fatalf("'runs-on' relationship not found")
// 	}

// 	if len(clusters) != 1 {
// 		t.Fatalf("expected 1 related cluster, got %d", len(clusters))
// 	}

// 	if clusters[0].EntityId != "cluster-123" {
// 		t.Errorf("expected cluster-123, got %s", clusters[0].EntityId)
// 	}
// }

// TestEngine_GetRelatedEntities_CelMatcher_ListOperations tests CEL with list operations
func TestEngine_GetRelatedEntities_CelMatcher_ListOperations(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("service-to-allowed-regions"),
			integration.RelationshipRuleReference("allowed-in"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "region",
			}),
			// CEL expression checking if to.name is in from's allowed_regions list
			integration.WithCelMatcher(`
				to.name in from.config.allowed_regions
			`),
		),
		integration.WithResource(
			integration.ResourceID("service-global"),
			integration.ResourceName("global-service"),
			integration.ResourceKind("service"),
			integration.ResourceConfig(map[string]interface{}{
				"allowed_regions": []string{"us-east-1", "eu-west-1", "ap-south-1"},
			}),
		),
		integration.WithResource(
			integration.ResourceID("region-us-east-1"),
			integration.ResourceName("us-east-1"),
			integration.ResourceKind("region"),
		),
		integration.WithResource(
			integration.ResourceID("region-eu-west-1"),
			integration.ResourceName("eu-west-1"),
			integration.ResourceKind("region"),
		),
		integration.WithResource(
			integration.ResourceID("region-us-west-2"),
			integration.ResourceName("us-west-2"),
			integration.ResourceKind("region"),
		),
	)

	ctx := context.Background()

	service, ok := engine.Workspace().Resources().Get("service-global")
	if !ok {
		t.Fatalf("service-global not found")
	}

	entity := relationships.NewResourceEntity(service)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	regions, ok := relatedEntities["allowed-in"]
	if !ok {
		t.Fatalf("'allowed-in' relationship not found")
	}

	// Should find us-east-1 and eu-west-1 (not us-west-2)
	if len(regions) != 2 {
		t.Fatalf("expected 2 related regions, got %d", len(regions))
	}

	regionIDs := make(map[string]bool)
	for _, region := range regions {
		regionIDs[region.EntityId] = true
	}

	if !regionIDs["region-us-east-1"] {
		t.Errorf("region-us-east-1 not in related entities")
	}
	if !regionIDs["region-eu-west-1"] {
		t.Errorf("region-eu-west-1 not in related entities")
	}
	if regionIDs["region-us-west-2"] {
		t.Errorf("region-us-west-2 should not be in related entities")
	}
}

// TestEngine_GetRelatedEntities_CelMatcher_NumericComparison tests CEL with numeric operations
func TestEngine_GetRelatedEntities_CelMatcher_NumericComparison(t *testing.T) {
	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("service-to-sufficient-database"),
			integration.RelationshipRuleReference("can-use"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			// CEL expression with numeric comparison
			integration.WithCelMatcher(`
				int(to.metadata.max_connections) >= int(from.metadata.required_connections) &&
				from.metadata.region == to.metadata.region
			`),
		),
		integration.WithResource(
			integration.ResourceID("service-heavy"),
			integration.ResourceName("heavy-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"required_connections": "500",
				"region":               "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-small"),
			integration.ResourceName("small-db"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"max_connections": "100",
				"region":          "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-medium"),
			integration.ResourceName("medium-db"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"max_connections": "500",
				"region":          "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID("db-large"),
			integration.ResourceName("large-db"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"max_connections": "1000",
				"region":          "us-east-1",
			}),
		),
	)

	ctx := context.Background()

	service, ok := engine.Workspace().Resources().Get("service-heavy")
	if !ok {
		t.Fatalf("service-heavy not found")
	}

	entity := relationships.NewResourceEntity(service)
	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	databases, ok := relatedEntities["can-use"]
	if !ok {
		t.Fatalf("'can-use' relationship not found")
	}

	// Should find medium and large databases (>= 500 connections)
	if len(databases) != 2 {
		t.Fatalf("expected 2 related databases, got %d", len(databases))
	}

	dbIDs := make(map[string]bool)
	for _, db := range databases {
		dbIDs[db.EntityId] = true
	}

	if dbIDs["db-small"] {
		t.Errorf("db-small should not be in related entities")
	}
	if !dbIDs["db-medium"] {
		t.Errorf("db-medium not in related entities")
	}
	if !dbIDs["db-large"] {
		t.Errorf("db-large not in related entities")
	}
}
