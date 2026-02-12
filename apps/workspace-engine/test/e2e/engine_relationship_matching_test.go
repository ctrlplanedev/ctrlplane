package e2e

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
)

// TestEngine_GetRelatedEntities_ResourceToResource tests finding related resources
func TestEngine_GetRelatedEntities_ResourceToResource(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	vpcUsWest2ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterEast2ID := uuid.New().String()
	clusterWest1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleType("contains"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(vpcUsWest2ID),
			integration.ResourceName("vpc-us-west-2"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast2ID),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterWest1ID),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsWest2ID),
				integration.ResourceName("vpc-us-west-2"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast2ID),
				integration.ResourceName("cluster-east-2"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterWest1ID),
				integration.ResourceName("cluster-west-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Test from VPC in us-east-1 to clusters
		vpcEast, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
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

		if !clusterIDs[clusterEast1ID] {
			t.Errorf("cluster-east-1 not in related entities")
		}
		if !clusterIDs[clusterEast2ID] {
			t.Errorf("cluster-east-2 not in related entities")
		}
		if clusterIDs[clusterWest1ID] {
			t.Errorf("cluster-west-1 should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_BidirectionalRelationship tests that relationships work in both directions
func TestEngine_GetRelatedEntities_BidirectionalRelationship(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("part-of"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Test from cluster to VPC (reverse direction)
		cluster, ok := engine.Workspace().Resources().Get(clusterEast1ID)
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

		if vpcs[0].EntityId != vpcUsEast1ID {
			t.Errorf("expected vpc-us-east-1, got %s", vpcs[0].EntityId)
		}

	})
}

// TestEngine_GetRelatedEntities_DeploymentToResource tests deployment to resource relationships
func TestEngine_GetRelatedEntities_DeploymentToResource(t *testing.T) {
	relRuleID := uuid.New().String()
	deploymentApiID := uuid.New().String()
	deploymentWorkerID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterWest1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("deployment-to-cluster"),
		integration.RelationshipRuleReference("runs-on"),
		integration.RelationshipRuleFromType("deployment"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.jobAgentConfig.region == to.metadata.region"),
	)

	system := integration.WithSystem(
		integration.SystemName("test-system"),
		integration.WithDeployment(
			integration.DeploymentID(deploymentApiID),
			integration.DeploymentName("api"),
			integration.DeploymentJobAgentConfig(map[string]any{
				"region": "us-east-1",
			}),
		),
		integration.WithDeployment(
			integration.DeploymentID(deploymentWorkerID),
			integration.DeploymentName("worker"),
			integration.DeploymentJobAgentConfig(map[string]any{
				"region": "us-west-2",
			}),
		),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		system,
		rule,
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterWest1ID),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		system,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterWest1ID),
				integration.ResourceName("cluster-west-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Test from deployment to resources
		deployment, ok := engine.Workspace().Deployments().Get(deploymentApiID)
		if !ok {
			t.Fatalf("deployment-api not found")
		}

		entity := relationships.NewDeploymentEntity(deployment)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["runs-on"]
		if !ok {
			t.Fatalf("'runs-on' relationship not found")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster, got %d", len(clusters))
		}

		if clusters[0].EntityId != clusterEast1ID {
			t.Errorf("expected cluster-east-1, got %s", clusters[0].EntityId)
		}
	})
}

// TestEngine_GetRelatedEntities_EnvironmentToResource tests environment to resource relationships
func TestEngine_GetRelatedEntities_EnvironmentToResource(t *testing.T) {
	relRuleID := uuid.New().String()
	envProdID := uuid.New().String()
	envStagingID := uuid.New().String()
	dbProdID := uuid.New().String()
	cacheProdID := uuid.New().String()
	dbStagingID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("environment-to-resource"),
		integration.RelationshipRuleReference("has-resources"),
		integration.RelationshipRuleFromType("environment"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("environment.name == 'production'"),
		integration.RelationshipRuleToCelSelector("resource.metadata.environment == 'prod'"),
	)

	system := integration.WithSystem(
		integration.SystemName("test-system"),
		integration.WithEnvironment(
			integration.EnvironmentID(envProdID),
			integration.EnvironmentName("production"),
		),
		integration.WithEnvironment(
			integration.EnvironmentID(envStagingID),
			integration.EnvironmentName("staging"),
		),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		system,
		rule,
		integration.WithResource(
			integration.ResourceID(dbProdID),
			integration.ResourceName("db-prod"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"environment": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID(cacheProdID),
			integration.ResourceName("cache-prod"),
			integration.ResourceKind("cache"),
			integration.ResourceMetadata(map[string]string{
				"environment": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbStagingID),
			integration.ResourceName("db-staging"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"environment": "staging",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		system,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbProdID),
				integration.ResourceName("db-prod"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"environment": "prod",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(cacheProdID),
				integration.ResourceName("cache-prod"),
				integration.ResourceKind("cache"),
				integration.ResourceMetadata(map[string]string{
					"environment": "prod",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbStagingID),
				integration.ResourceName("db-staging"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"environment": "staging",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Test from environment to resources
		environment, ok := engine.Workspace().Environments().Get(envProdID)
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

		if !resourceIDs[dbProdID] {
			t.Errorf("db-prod not in related entities")
		}
		if !resourceIDs[cacheProdID] {
			t.Errorf("cache-prod not in related entities")
		}
		if resourceIDs[dbStagingID] {
			t.Errorf("db-staging should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_MultipleRelationships tests entity with multiple relationship rules
func TestEngine_GetRelatedEntities_MultipleRelationships(t *testing.T) {
	relRule1ID := uuid.New().String()
	relRule2ID := uuid.New().String()
	vpc1ID := uuid.New().String()
	cluster1ID := uuid.New().String()
	cluster2ID := uuid.New().String()
	db1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule1 := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRule1ID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains-clusters"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.id == to.metadata.vpc_id"),
	)

	rule2 := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRule2ID),
		integration.RelationshipRuleName("vpc-to-database"),
		integration.RelationshipRuleReference("contains-databases"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'database'"),
		integration.WithCelMatcher("from.id == to.metadata.vpc_id"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule1,
		rule2,
		integration.WithResource(
			integration.ResourceID(vpc1ID),
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
		),
		integration.WithResource(
			integration.ResourceID(cluster1ID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpc1ID,
			}),
		),
		integration.WithResource(
			integration.ResourceID(cluster2ID),
			integration.ResourceName("cluster-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpc1ID,
			}),
		),
		integration.WithResource(
			integration.ResourceID(db1ID),
			integration.ResourceName("db-1"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpc1ID,
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule1,
		rule2,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpc1ID),
				integration.ResourceName("vpc-1"),
				integration.ResourceKind("vpc"),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(cluster1ID),
				integration.ResourceName("cluster-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"vpc_id": vpc1ID,
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(cluster2ID),
				integration.ResourceName("cluster-2"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"vpc_id": vpc1ID,
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(db1ID),
				integration.ResourceName("db-1"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"vpc_id": vpc1ID,
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		vpc, ok := engine.Workspace().Resources().Get(vpc1ID)
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
	})
}

// TestEngine_GetRelatedEntities_PropertyMatcherNotEquals tests not_equals operator
func TestEngine_GetRelatedEntities_PropertyMatcherNotEquals(t *testing.T) {
	relRuleID := uuid.New().String()
	dbEastID := uuid.New().String()
	dbWestID := uuid.New().String()
	dbEastOtherID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("cross-region-replication"),
		integration.RelationshipRuleReference("replicates-to"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'database'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'database'"),
		integration.WithCelMatcher("from.metadata.region != to.metadata.region && from.metadata.cluster_name == to.metadata.cluster_name"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(dbEastID),
			integration.ResourceName("db-east"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region":       "us-east-1",
				"cluster_name": "my-cluster",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbWestID),
			integration.ResourceName("db-west"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region":       "us-west-2",
				"cluster_name": "my-cluster",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbEastOtherID),
			integration.ResourceName("db-east-other"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region":       "us-east-1",
				"cluster_name": "other-cluster",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbEastID),
				integration.ResourceName("db-east"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region":       "us-east-1",
					"cluster_name": "my-cluster",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbWestID),
				integration.ResourceName("db-west"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region":       "us-west-2",
					"cluster_name": "my-cluster",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbEastOtherID),
				integration.ResourceName("db-east-other"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region":       "us-east-1",
					"cluster_name": "other-cluster",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		dbEast, ok := engine.Workspace().Resources().Get(dbEastID)
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

		// Should find db-west in both directions (same cluster, different region)
		// Resource-to-resource relationships are bidirectional: db-east->db-west (to) and db-east<-db-west (from)
		// Self-relationships are skipped, so db-east does not relate to itself
		if len(replicas) != 2 {
			t.Fatalf("expected 2 replicas, got %d", len(replicas))
		}

		// Verify both are db-west
		for _, replica := range replicas {
			if replica.EntityId != dbWestID {
				t.Errorf("expected db-west, got %s", replica.EntityId)
			}
		}
	})
}

// TestEngine_GetRelatedEntities_PropertyMatcherContains tests contains operator
func TestEngine_GetRelatedEntities_PropertyMatcherContains(t *testing.T) {
	relRuleID := uuid.New().String()
	serviceApiID := uuid.New().String()
	endpoint1ID := uuid.New().String()
	endpoint2ID := uuid.New().String()
	endpoint3ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("service-to-endpoint"),
		integration.RelationshipRuleReference("exposes"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'service'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'endpoint'"),
		integration.WithCelMatcher("from.metadata.prefix.contains(to.name)"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(serviceApiID),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"prefix": "api-service-v1,api-service-v2",
			}),
		),
		integration.WithResource(
			integration.ResourceID(endpoint1ID),
			integration.ResourceName("api-service-v1"),
			integration.ResourceKind("endpoint"),
		),
		integration.WithResource(
			integration.ResourceID(endpoint2ID),
			integration.ResourceName("api-service-v2"),
			integration.ResourceKind("endpoint"),
		),
		integration.WithResource(
			integration.ResourceID(endpoint3ID),
			integration.ResourceName("other-service"),
			integration.ResourceKind("endpoint"),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(serviceApiID),
				integration.ResourceName("api-service"),
				integration.ResourceKind("service"),
				integration.ResourceMetadata(map[string]string{
					"prefix": "api-service-v1,api-service-v2",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(endpoint1ID),
				integration.ResourceName("api-service-v1"),
				integration.ResourceKind("endpoint"),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(endpoint2ID),
				integration.ResourceName("api-service-v2"),
				integration.ResourceKind("endpoint"),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(endpoint3ID),
				integration.ResourceName("other-service"),
				integration.ResourceKind("endpoint"),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		service, ok := engine.Workspace().Resources().Get(serviceApiID)
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

		if !endpointIDs[endpoint1ID] {
			t.Errorf("endpoint-1 not in related entities")
		}
		if !endpointIDs[endpoint2ID] {
			t.Errorf("endpoint-2 not in related entities")
		}
		if endpointIDs[endpoint3ID] {
			t.Errorf("endpoint-3 should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_PropertyMatcherStartsWith tests starts_with operator
func TestEngine_GetRelatedEntities_PropertyMatcherStartsWith(t *testing.T) {
	relRuleID := uuid.New().String()
	regionUsEastID := uuid.New().String()
	dc1ID := uuid.New().String()
	dc2ID := uuid.New().String()
	dc3ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("region-to-resource"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'region'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'datacenter'"),
		integration.WithCelMatcher("from.metadata.region_code.startsWith(to.metadata.code_prefix)"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(regionUsEastID),
			integration.ResourceName("us-east"),
			integration.ResourceKind("region"),
			integration.ResourceMetadata(map[string]string{
				"region_code": "us-east-1a",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dc1ID),
			integration.ResourceName("dc-1"),
			integration.ResourceKind("datacenter"),
			integration.ResourceMetadata(map[string]string{
				"code_prefix": "us-east",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dc2ID),
			integration.ResourceName("dc-2"),
			integration.ResourceKind("datacenter"),
			integration.ResourceMetadata(map[string]string{
				"code_prefix": "us",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dc3ID),
			integration.ResourceName("dc-3"),
			integration.ResourceKind("datacenter"),
			integration.ResourceMetadata(map[string]string{
				"code_prefix": "eu-west",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(regionUsEastID),
				integration.ResourceName("us-east"),
				integration.ResourceKind("region"),
				integration.ResourceMetadata(map[string]string{
					"region_code": "us-east-1a",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dc1ID),
				integration.ResourceName("dc-1"),
				integration.ResourceKind("datacenter"),
				integration.ResourceMetadata(map[string]string{
					"code_prefix": "us-east",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dc2ID),
				integration.ResourceName("dc-2"),
				integration.ResourceKind("datacenter"),
				integration.ResourceMetadata(map[string]string{
					"code_prefix": "us",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dc3ID),
				integration.ResourceName("dc-3"),
				integration.ResourceKind("datacenter"),
				integration.ResourceMetadata(map[string]string{
					"code_prefix": "eu-west",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		region, ok := engine.Workspace().Resources().Get(regionUsEastID)
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

		if !dcIDs[dc1ID] {
			t.Errorf("dc-1 not in related entities")
		}
		if !dcIDs[dc2ID] {
			t.Errorf("dc-2 not in related entities")
		}
		if dcIDs[dc3ID] {
			t.Errorf("dc-3 should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_PropertyMatcherEndsWith tests ends_with operator
func TestEngine_GetRelatedEntities_PropertyMatcherEndsWith(t *testing.T) {
	relRuleID := uuid.New().String()
	app1ID := uuid.New().String()
	log1ID := uuid.New().String()
	log2ID := uuid.New().String()
	log3ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("app-to-logs"),
		integration.RelationshipRuleReference("has-logs"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'application'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'log-stream'"),
		integration.WithCelMatcher("from.metadata.app_id.endsWith(to.metadata.suffix)"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(app1ID),
			integration.ResourceName("app-1"),
			integration.ResourceKind("application"),
			integration.ResourceMetadata(map[string]string{
				"app_id": "service-a-app-123",
			}),
		),
		integration.WithResource(
			integration.ResourceID(log1ID),
			integration.ResourceName("log-1"),
			integration.ResourceKind("log-stream"),
			integration.ResourceMetadata(map[string]string{
				"suffix": "-app-123",
			}),
		),
		integration.WithResource(
			integration.ResourceID(log2ID),
			integration.ResourceName("log-2"),
			integration.ResourceKind("log-stream"),
			integration.ResourceMetadata(map[string]string{
				"suffix": "-app-123",
			}),
		),
		integration.WithResource(
			integration.ResourceID(log3ID),
			integration.ResourceName("log-3"),
			integration.ResourceKind("log-stream"),
			integration.ResourceMetadata(map[string]string{
				"suffix": "-app-456",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(app1ID),
				integration.ResourceName("app-1"),
				integration.ResourceKind("application"),
				integration.ResourceMetadata(map[string]string{
					"app_id": "service-a-app-123",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(log1ID),
				integration.ResourceName("log-1"),
				integration.ResourceKind("log-stream"),
				integration.ResourceMetadata(map[string]string{
					"suffix": "-app-123",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(log2ID),
				integration.ResourceName("log-2"),
				integration.ResourceKind("log-stream"),
				integration.ResourceMetadata(map[string]string{
					"suffix": "-app-123",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(log3ID),
				integration.ResourceName("log-3"),
				integration.ResourceKind("log-stream"),
				integration.ResourceMetadata(map[string]string{
					"suffix": "-app-456",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		app, ok := engine.Workspace().Resources().Get(app1ID)
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

		if !logIDs[log1ID] {
			t.Errorf("log-1 not in related entities")
		}
		if !logIDs[log2ID] {
			t.Errorf("log-2 not in related entities")
		}
		if logIDs[log3ID] {
			t.Errorf("log-3 should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_NoSelectorMatchNone tests nil selectors that match all entities of that type
func TestEngine_GetRelatedEntities_NoSelectorMatchAll(t *testing.T) {
	relRuleID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	resource3ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("all-resources-in-region"),
		integration.RelationshipRuleReference("in-region"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		// No selectors - matches all resources of the specified types
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("resource-1"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("resource-2"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resource3ID),
			integration.ResourceName("resource-3"),
			integration.ResourceKind("cache"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(resource1ID),
				integration.ResourceName("resource-1"),
				integration.ResourceKind("service"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(resource2ID),
				integration.ResourceName("resource-2"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(resource3ID),
				integration.ResourceName("resource-3"),
				integration.ResourceKind("cache"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		resource1, ok := engine.Workspace().Resources().Get(resource1ID)
		if !ok {
			t.Fatalf("resource-1 not found")
		}

		entity := relationships.NewResourceEntity(resource1)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		related, ok := relatedEntities["in-region"]
		if !ok {
			t.Fatalf("'in-region' relationship not found")
		}

		for _, rel := range related {
			fmt.Println(rel.EntityId, rel.Direction)
		}

		// With nil selectors, all resources with matching properties should match
		// resource-1 (us-east-1) relates to resource-2 (us-east-1) but not resource-3 (us-west-2)
		// Self-relationships are skipped, so resource-1 does not relate to itself
		// Bidirectional: resource-1->resource-2 (to) and resource-1<-resource-2 (from)
		if len(related) != 2 {
			t.Fatalf("expected 2 related entities, got %d", len(related))
		}

		// Verify both are resource-2 (in both directions)
		for _, res := range related {
			if res.EntityId != resource2ID {
				t.Errorf("expected resource-2, got %s", res.EntityId)
			}
		}
	})
}

// TestEngine_GetRelatedEntities_ConfigPropertyPath tests accessing nested config properties
func TestEngine_GetRelatedEntities_ConfigPropertyPath(t *testing.T) {
	relRuleID := uuid.New().String()
	serviceApiID := uuid.New().String()
	servicePostgresID := uuid.New().String()
	serviceRedisID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("service-to-dependency"),
		integration.RelationshipRuleReference("depends-on"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'service'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'service'"),
		integration.WithCelMatcher("from.config.dependencies.database == to.name"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(serviceApiID),
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
			integration.ResourceID(servicePostgresID),
			integration.ResourceName("postgres-service"),
			integration.ResourceKind("service"),
		),
		integration.WithResource(
			integration.ResourceID(serviceRedisID),
			integration.ResourceName("redis-service"),
			integration.ResourceKind("service"),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(serviceApiID),
				integration.ResourceName("api-service"),
				integration.ResourceKind("service"),
				integration.ResourceConfig(map[string]interface{}{
					"dependencies": map[string]interface{}{
						"database": "postgres-service",
						"cache":    "redis-service",
					},
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(servicePostgresID),
				integration.ResourceName("postgres-service"),
				integration.ResourceKind("service"),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(serviceRedisID),
				integration.ResourceName("redis-service"),
				integration.ResourceKind("service"),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		apiService, ok := engine.Workspace().Resources().Get(serviceApiID)
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

		if dependencies[0].EntityId != servicePostgresID {
			t.Errorf("expected service-postgres, got %s", dependencies[0].EntityId)
		}
	})
}

// TestEngine_GetRelatedEntities_NoMatchingRelationships tests entity with no matching relationships
func TestEngine_GetRelatedEntities_NoMatchingRelationships(t *testing.T) {
	relRuleID := uuid.New().String()
	database1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("true"), // No property matcher needed
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(database1ID),
			integration.ResourceName("database-1"),
			integration.ResourceKind("database"),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(database1ID),
				integration.ResourceName("database-1"),
				integration.ResourceKind("database"),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		database, ok := engine.Workspace().Resources().Get(database1ID)
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
	})
}

// TestEngine_GetRelatedEntities_EmptyResults tests relationship rule that matches but finds no targets
func TestEngine_GetRelatedEntities_EmptyResults(t *testing.T) {
	relRuleID := uuid.New().String()
	vpc1ID := uuid.New().String()
	cluster1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpc1ID),
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(cluster1ID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpc1ID),
				integration.ResourceName("vpc-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(cluster1ID),
				integration.ResourceName("cluster-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		vpc, ok := engine.Workspace().Resources().Get(vpc1ID)
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
	})
}

// TestEngine_GetRelatedEntities_CelMatcher_SimpleComparison tests basic CEL expression matching
func TestEngine_GetRelatedEntities_CelMatcher_SimpleComparison(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	vpcUsWest2ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterEast2ID := uuid.New().String()
	clusterWest1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster-cel"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(vpcUsWest2ID),
			integration.ResourceName("vpc-us-west-2"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast2ID),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterWest1ID),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsWest2ID),
				integration.ResourceName("vpc-us-west-2"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast2ID),
				integration.ResourceName("cluster-east-2"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterWest1ID),
				integration.ResourceName("cluster-west-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Test from VPC in us-east-1 to clusters
		vpcEast, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
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

		if !clusterIDs[clusterEast1ID] {
			t.Errorf("cluster-east-1 not in related entities")
		}
		if !clusterIDs[clusterEast2ID] {
			t.Errorf("cluster-east-2 not in related entities")
		}
		if clusterIDs[clusterWest1ID] {
			t.Errorf("cluster-west-1 should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_CelMatcher_ComplexExpression tests CEL with complex logic
func TestEngine_GetRelatedEntities_CelMatcher_ComplexExpression(t *testing.T) {
	relRuleID := uuid.New().String()
	serviceApiID := uuid.New().String()
	dbPostgresID := uuid.New().String()
	dbMysqlID := uuid.New().String()
	dbPostgresWestID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("service-to-dependency-cel"),
		integration.RelationshipRuleReference("depends-on"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'service'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'database'"),
		// CEL expression with multiple conditions and string operations
		integration.WithCelMatcher(`
				from.metadata.region == to.metadata.region &&
				to.metadata.tier == "critical" &&
				from.config.database_name.startsWith(to.name)
			`),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(serviceApiID),
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
			integration.ResourceID(dbPostgresID),
			integration.ResourceName("postgres-prod"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"tier":   "critical",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbMysqlID),
			integration.ResourceName("mysql-prod"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"tier":   "standard",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbPostgresWestID),
			integration.ResourceName("postgres-west"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
				"tier":   "critical",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(serviceApiID),
				integration.ResourceName("api-service"),
				integration.ResourceKind("service"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
				integration.ResourceConfig(map[string]interface{}{
					"database_name": "postgres-prod-db",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbPostgresID),
				integration.ResourceName("postgres-prod"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
					"tier":   "critical",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbMysqlID),
				integration.ResourceName("mysql-prod"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
					"tier":   "standard",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbPostgresWestID),
				integration.ResourceName("postgres-west"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
					"tier":   "critical",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		apiService, ok := engine.Workspace().Resources().Get(serviceApiID)
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

		if dependencies[0].EntityId != dbPostgresID {
			t.Errorf("expected db-postgres, got %s", dependencies[0].EntityId)
		}
	})
}

// TestEngine_GetRelatedEntities_CelMatcher_CrossEntityType tests CEL matching deployment to resource
func TestEngine_GetRelatedEntities_CelMatcher_CrossEntityType(t *testing.T) {
	relRuleID := uuid.New().String()
	deploymentApiID := uuid.New().String()
	deploymentWorkerID := uuid.New().String()
	cluster123ID := uuid.New().String()
	cluster456ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("deployment-to-cluster-cel"),
		integration.RelationshipRuleReference("runs-on"),
		integration.RelationshipRuleFromType("deployment"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		// CEL expression accessing deployment properties
		integration.WithCelMatcher(`
			from.jobAgentConfig.region == to.metadata.region &&
			from.jobAgentConfig.cluster_id == to.id
		`),
	)

	system := integration.WithSystem(
		integration.SystemName("test-system"),
		integration.WithDeployment(
			integration.DeploymentID(deploymentApiID),
			integration.DeploymentName("api"),
			integration.DeploymentJobAgentConfig(map[string]any{
				"region":     "us-east-1",
				"cluster_id": cluster123ID,
			}),
		),
		integration.WithDeployment(
			integration.DeploymentID(deploymentWorkerID),
			integration.DeploymentName("worker"),
			integration.DeploymentJobAgentConfig(map[string]any{
				"region":     "us-west-2",
				"cluster_id": cluster456ID,
			}),
		),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		system,
		rule,
		integration.WithResource(
			integration.ResourceID(cluster123ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(cluster456ID),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		system,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(cluster123ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(cluster456ID),
				integration.ResourceName("cluster-west-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Test from deployment to resources
		deployment, ok := engine.Workspace().Deployments().Get(deploymentApiID)
		if !ok {
			t.Fatalf("deployment-api not found")
		}

		entity := relationships.NewDeploymentEntity(deployment)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["runs-on"]
		if !ok {
			t.Fatalf("'runs-on' relationship not found")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster, got %d", len(clusters))
		}

		if clusters[0].EntityId != cluster123ID {
			t.Errorf("expected cluster-123, got %s", clusters[0].EntityId)
		}
	})
}

// TestEngine_GetRelatedEntities_CelMatcher_ListOperations tests CEL with list operations
func TestEngine_GetRelatedEntities_CelMatcher_ListOperations(t *testing.T) {
	relRuleID := uuid.New().String()
	serviceGlobalID := uuid.New().String()
	regionUsEast1ID := uuid.New().String()
	regionEuWest1ID := uuid.New().String()
	regionUsWest2ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("service-to-allowed-regions"),
		integration.RelationshipRuleReference("allowed-in"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'service'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'region'"),
		// CEL expression checking if to.name is in from's allowed_regions list
		integration.WithCelMatcher(`
				to.name in from.config.allowed_regions
			`),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(serviceGlobalID),
			integration.ResourceName("global-service"),
			integration.ResourceKind("service"),
			integration.ResourceConfig(map[string]interface{}{
				"allowed_regions": []string{"us-east-1", "eu-west-1", "ap-south-1"},
			}),
		),
		integration.WithResource(
			integration.ResourceID(regionUsEast1ID),
			integration.ResourceName("us-east-1"),
			integration.ResourceKind("region"),
		),
		integration.WithResource(
			integration.ResourceID(regionEuWest1ID),
			integration.ResourceName("eu-west-1"),
			integration.ResourceKind("region"),
		),
		integration.WithResource(
			integration.ResourceID(regionUsWest2ID),
			integration.ResourceName("us-west-2"),
			integration.ResourceKind("region"),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(serviceGlobalID),
				integration.ResourceName("global-service"),
				integration.ResourceKind("service"),
				integration.ResourceConfig(map[string]interface{}{
					"allowed_regions": []string{"us-east-1", "eu-west-1", "ap-south-1"},
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(regionUsEast1ID),
				integration.ResourceName("us-east-1"),
				integration.ResourceKind("region"),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(regionEuWest1ID),
				integration.ResourceName("eu-west-1"),
				integration.ResourceKind("region"),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(regionUsWest2ID),
				integration.ResourceName("us-west-2"),
				integration.ResourceKind("region"),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		service, ok := engine.Workspace().Resources().Get(serviceGlobalID)
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

		if !regionIDs[regionUsEast1ID] {
			t.Errorf("region-us-east-1 not in related entities")
		}
		if !regionIDs[regionEuWest1ID] {
			t.Errorf("region-eu-west-1 not in related entities")
		}
		if regionIDs[regionUsWest2ID] {
			t.Errorf("region-us-west-2 should not be in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_CelMatcher_NumericComparison tests CEL with numeric operations
func TestEngine_GetRelatedEntities_CelMatcher_NumericComparison(t *testing.T) {
	relRuleID := uuid.New().String()
	serviceHeavyID := uuid.New().String()
	dbSmallID := uuid.New().String()
	dbMediumID := uuid.New().String()
	dbLargeID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("service-to-sufficient-database"),
		integration.RelationshipRuleReference("can-use"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'service'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'database'"),
		// CEL expression with numeric comparison
		integration.WithCelMatcher(`
				int(to.metadata.max_connections) >= int(from.metadata.required_connections) &&
				from.metadata.region == to.metadata.region
			`),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(serviceHeavyID),
			integration.ResourceName("heavy-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"required_connections": "500",
				"region":               "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbSmallID),
			integration.ResourceName("small-db"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"max_connections": "100",
				"region":          "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbMediumID),
			integration.ResourceName("medium-db"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"max_connections": "500",
				"region":          "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbLargeID),
			integration.ResourceName("large-db"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"max_connections": "1000",
				"region":          "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(serviceHeavyID),
				integration.ResourceName("heavy-service"),
				integration.ResourceKind("service"),
				integration.ResourceMetadata(map[string]string{
					"required_connections": "500",
					"region":               "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbSmallID),
				integration.ResourceName("small-db"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"max_connections": "100",
					"region":          "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbMediumID),
				integration.ResourceName("medium-db"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"max_connections": "500",
					"region":          "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbLargeID),
				integration.ResourceName("large-db"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"max_connections": "1000",
					"region":          "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		service, ok := engine.Workspace().Resources().Get(serviceHeavyID)
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

		if dbIDs[dbSmallID] {
			t.Errorf("db-small should not be in related entities")
		}
		if !dbIDs[dbMediumID] {
			t.Errorf("db-medium not in related entities")
		}
		if !dbIDs[dbLargeID] {
			t.Errorf("db-large not in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_DeleteResource tests that deleting a resource updates relationships
func TestEngine_GetRelatedEntities_DeleteResource(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterEast2ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast2ID),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast2ID),
				integration.ResourceName("cluster-east-2"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// First verify we have 2 related clusters
		vpc, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpc)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found")
		}

		if len(clusters) != 2 {
			t.Fatalf("expected 2 related clusters initially, got %d", len(clusters))
		}

		// Delete one of the clusters
		engine.Workspace().Resources().Remove(ctx, clusterEast1ID)

		// Verify we now have only 1 related cluster
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after delete: %v", err)
		}

		clusters, ok = relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found after delete")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster after delete, got %d", len(clusters))
		}

		if clusters[0].EntityId != clusterEast2ID {
			t.Errorf("expected cluster-east-2, got %s", clusters[0].EntityId)
		}

		// Delete the last cluster
		engine.Workspace().Resources().Remove(ctx, clusterEast2ID)

		// Verify we now have no relationships
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after second delete: %v", err)
		}

		if len(relatedEntities) != 0 {
			t.Fatalf("expected no relationships after deleting all clusters, got %d", len(relatedEntities))
		}
	})
}

// TestEngine_GetRelatedEntities_DeleteFromResource tests deleting the source resource
func TestEngine_GetRelatedEntities_DeleteFromResource(t *testing.T) {
	relRuleID := uuid.New().String()
	dbEastID := uuid.New().String()
	dbWestID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("database-replication"),
		integration.RelationshipRuleReference("replicates-to"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'database'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'database'"),
		integration.WithCelMatcher("from.metadata.region != to.metadata.region && from.metadata.name == to.metadata.name"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(dbEastID),
			integration.ResourceName("db-east"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"name":   "my-db",
			}),
		),
		integration.WithResource(
			integration.ResourceID(dbWestID),
			integration.ResourceName("db-west"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
				"name":   "my-db",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbEastID),
				integration.ResourceName("db-east"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
					"name":   "my-db",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(dbWestID),
				integration.ResourceName("db-west"),
				integration.ResourceKind("database"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
					"name":   "my-db",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Check db-west has relationship to db-east
		dbWest, ok := engine.Workspace().Resources().Get(dbWestID)
		if !ok {
			t.Fatalf("db-west not found")
		}

		entity := relationships.NewResourceEntity(dbWest)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		replicas, ok := relatedEntities["replicates-to"]
		if !ok {
			t.Fatalf("'replicates-to' relationship not found")
		}

		if len(replicas) != 2 {
			t.Fatalf("expected 2 replicas initially, got %d", len(replicas))
		}

		// Delete db-east (the from resource from db-west's perspective)
		engine.Workspace().Resources().Remove(ctx, dbEastID)

		// Verify db-west no longer has any relationships
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after delete: %v", err)
		}

		if len(relatedEntities) != 0 {
			t.Fatalf("expected no relationships after deleting db-east, got %d", len(relatedEntities))
		}
	})
}

// TestEngine_GetRelatedEntities_AddResource tests that adding a resource creates new relationships
func TestEngine_GetRelatedEntities_AddResource(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterEast2ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Initially should have 1 related cluster
		vpc, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpc)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster initially, got %d", len(clusters))
		}

		// Add a new cluster in the same region
		// The engine automatically invalidates all potential source entities (like VPC)
		// that might have relationships to this new resource
		engine.PushEvent(ctx, handler.ResourceCreate, &oapi.Resource{
			Id:          clusterEast2ID,
			Name:        "cluster-east-2",
			Kind:        "kubernetes-cluster",
			WorkspaceId: engine.Workspace().ID,
			Metadata: map[string]string{
				"region": "us-east-1",
			},
		})

		// Verify we now have 2 related clusters
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after add: %v", err)
		}

		clusters, ok = relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found after add")
		}

		if len(clusters) != 2 {
			t.Fatalf("expected 2 related clusters after add, got %d", len(clusters))
		}

		clusterIDs := make(map[string]bool)
		for _, cluster := range clusters {
			clusterIDs[cluster.EntityId] = true
		}

		if !clusterIDs[clusterEast1ID] {
			t.Errorf("cluster-east-1 not in related entities")
		}
		if !clusterIDs[clusterEast2ID] {
			t.Errorf("cluster-east-2 not in related entities")
		}
	})
}

// TestEngine_GetRelatedEntities_UpdateResourceMetadata tests that updating resource metadata updates relationships
func TestEngine_GetRelatedEntities_UpdateResourceMetadata(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	cluster1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(cluster1ID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(cluster1ID),
				integration.ResourceName("cluster-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Initially should have 1 related cluster
		vpc, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpc)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster initially, got %d", len(clusters))
		}

		// Update cluster to different region
		cluster, ok := engine.Workspace().Resources().Get(cluster1ID)
		if !ok {
			t.Fatalf("cluster-1 not found")
		}
		cluster.Metadata = map[string]string{
			"region": "us-west-2",
		}
		engine.PushEvent(ctx, handler.ResourceUpdate, cluster)

		// Verify relationship is now gone
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after update: %v", err)
		}

		if len(relatedEntities) != 0 {
			t.Fatalf("expected no relationships after changing region, got %d", len(relatedEntities))
		}
	})
}

// TestEngine_GetRelatedEntities_DeleteRelationshipRule tests that deleting a rule removes relationships
func TestEngine_GetRelatedEntities_DeleteRelationshipRule(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Initially should have relationships
		vpc, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpc)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster initially, got %d", len(clusters))
		}

		// Delete the relationship rule
		rule, ok := engine.Workspace().RelationshipRules().Get(relRuleID)
		if !ok {
			t.Fatalf("rel-rule-1 not found")
		}
		engine.PushEvent(ctx, handler.RelationshipRuleDelete, rule)

		// Verify relationships are gone
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after rule delete: %v", err)
		}

		if len(relatedEntities) != 0 {
			t.Fatalf("expected no relationships after deleting rule, got %d", len(relatedEntities))
		}
	})
}

// TestEngine_GetRelatedEntities_AddRelationshipRule tests that adding a rule creates new relationships
func TestEngine_GetRelatedEntities_AddRelationshipRule(t *testing.T) {
	vpcUsEast1ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	testProviderID := uuid.New().String()
	relRuleID := uuid.New().String()

	engineDirect := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Initially should have no relationships
		vpc, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpc)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		if len(relatedEntities) != 0 {
			t.Fatalf("expected no relationships initially, got %d", len(relatedEntities))
		}

		// Add a relationship rule
		fromSelector := &oapi.Selector{}
		_ = fromSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'vpc'"})

		toSelector := &oapi.Selector{}
		_ = toSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})

		matcher := &oapi.RelationshipRule_Matcher{}
		_ = matcher.FromCelMatcher(oapi.CelMatcher{Cel: "from.metadata.region == to.metadata.region"})

		engine.PushEvent(ctx, handler.RelationshipRuleCreate, &oapi.RelationshipRule{
			Id:           relRuleID,
			Name:         "vpc-to-cluster",
			Reference:    "contains",
			FromType:     "resource",
			ToType:       "resource",
			FromSelector: fromSelector,
			ToSelector:   toSelector,
			Matcher:      *matcher,
			WorkspaceId:  engine.Workspace().ID,
		})

		// Verify relationships now exist
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after rule add: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found after adding rule")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster after adding rule, got %d", len(clusters))
		}

		if clusters[0].EntityId != clusterEast1ID {
			t.Errorf("expected cluster-east-1, got %s", clusters[0].EntityId)
		}
	})
}

// TestEngine_GetRelatedEntities_DeleteMultipleResources tests cascading deletions
func TestEngine_GetRelatedEntities_DeleteMultipleResources(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	vpcUsWest2ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterEast2ID := uuid.New().String()
	clusterWest1ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(vpcUsWest2ID),
			integration.ResourceName("vpc-us-west-2"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast2ID),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterWest1ID),
			integration.ResourceName("cluster-west-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsWest2ID),
				integration.ResourceName("vpc-us-west-2"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast2ID),
				integration.ResourceName("cluster-east-2"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterWest1ID),
				integration.ResourceName("cluster-west-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-west-2",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Verify vpc-us-east-1 has 2 related clusters
		vpcEast, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpcEast)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found")
		}

		if len(clusters) != 2 {
			t.Fatalf("expected 2 related clusters initially, got %d", len(clusters))
		}

		// Verify vpc-us-west-2 has 1 related cluster
		vpcWest, ok := engine.Workspace().Resources().Get(vpcUsWest2ID)
		if !ok {
			t.Fatalf("vpc-us-west-2 not found")
		}

		entityWest := relationships.NewResourceEntity(vpcWest)
		relatedEntitiesWest, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entityWest)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed for west: %v", err)
		}

		clustersWest, ok := relatedEntitiesWest["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found for west vpc")
		}

		if len(clustersWest) != 1 {
			t.Fatalf("expected 1 related cluster for west vpc, got %d", len(clustersWest))
		}

		// Delete all clusters in us-east-1
		engine.Workspace().Resources().Remove(ctx, clusterEast1ID)
		engine.Workspace().Resources().Remove(ctx, clusterEast2ID)

		// Verify vpc-us-east-1 has no relationships
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after deletes: %v", err)
		}

		if len(relatedEntities) != 0 {
			t.Fatalf("expected no relationships for vpc-us-east-1, got %d", len(relatedEntities))
		}

		// Verify vpc-us-west-2 still has its cluster
		relatedEntitiesWest, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entityWest)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed for west after deletes: %v", err)
		}

		clustersWest, ok = relatedEntitiesWest["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found for west vpc after deletes")
		}

		if len(clustersWest) != 1 {
			t.Fatalf("expected 1 related cluster for west vpc after deletes, got %d", len(clustersWest))
		}
	})
}

// TestEngine_GetRelatedEntities_UpdateRelationshipRule tests updating a relationship rule
func TestEngine_GetRelatedEntities_UpdateRelationshipRule(t *testing.T) {
	relRuleID := uuid.New().String()
	vpcUsEast1ID := uuid.New().String()
	clusterEast1ID := uuid.New().String()
	clusterEast2ID := uuid.New().String()
	testProviderID := uuid.New().String()

	rule := integration.WithRelationshipRule(
		integration.RelationshipRuleID(relRuleID),
		integration.RelationshipRuleName("vpc-to-cluster"),
		integration.RelationshipRuleReference("contains"),
		integration.RelationshipRuleFromType("resource"),
		integration.RelationshipRuleToType("resource"),
		integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
		integration.RelationshipRuleToCelSelector("resource.kind == 'kubernetes-cluster'"),
		integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
	)

	engineDirect := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResource(
			integration.ResourceID(vpcUsEast1ID),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast1ID),
			integration.ResourceName("cluster-east-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"tier":   "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterEast2ID),
			integration.ResourceName("cluster-east-2"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"tier":   "staging",
			}),
		),
	)

	engineWithProvider := integration.NewTestWorkspace(
		t,
		rule,
		integration.WithResourceProvider(
			integration.ProviderID(testProviderID),
			integration.ProviderName("test-provider"),
			integration.WithResourceProviderResource(
				integration.ResourceID(vpcUsEast1ID),
				integration.ResourceName("vpc-us-east-1"),
				integration.ResourceKind("vpc"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast1ID),
				integration.ResourceName("cluster-east-1"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
					"tier":   "prod",
				}),
			),
			integration.WithResourceProviderResource(
				integration.ResourceID(clusterEast2ID),
				integration.ResourceName("cluster-east-2"),
				integration.ResourceKind("kubernetes-cluster"),
				integration.ResourceMetadata(map[string]string{
					"region": "us-east-1",
					"tier":   "staging",
				}),
			),
		),
	)

	engines := map[string]*integration.TestWorkspace{
		"direct":        engineDirect,
		"with_provider": engineWithProvider,
	}

	integration.RunWithEngines(t, engines, func(t *testing.T, engine *integration.TestWorkspace) {
		ctx := context.Background()

		// Initially should have 2 related clusters
		vpc, ok := engine.Workspace().Resources().Get(vpcUsEast1ID)
		if !ok {
			t.Fatalf("vpc-us-east-1 not found")
		}

		entity := relationships.NewResourceEntity(vpc)
		relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed: %v", err)
		}

		clusters, ok := relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found")
		}

		if len(clusters) != 2 {
			t.Fatalf("expected 2 related clusters initially, got %d", len(clusters))
		}

		// Update the rule to add a tier filter
		fromSelector := &oapi.Selector{}
		_ = fromSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'vpc'"})

		toSelector := &oapi.Selector{}
		_ = toSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})

		matcher := &oapi.RelationshipRule_Matcher{}
		_ = matcher.FromCelMatcher(oapi.CelMatcher{Cel: "from.metadata.region == to.metadata.region && to.metadata.tier == 'prod'"})

		engine.PushEvent(ctx, handler.RelationshipRuleUpdate, &oapi.RelationshipRule{
			Id:           relRuleID,
			Name:         "vpc-to-cluster",
			Reference:    "contains",
			FromType:     "resource",
			ToType:       "resource",
			FromSelector: fromSelector,
			ToSelector:   toSelector,
			Matcher:      *matcher,
		})

		// Verify now only 1 cluster matches (tier == 'prod')
		relatedEntities, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			t.Fatalf("GetRelatedEntities failed after rule update: %v", err)
		}

		clusters, ok = relatedEntities["contains"]
		if !ok {
			t.Fatalf("'contains' relationship not found after update")
		}

		if len(clusters) != 1 {
			t.Fatalf("expected 1 related cluster after rule update, got %d", len(clusters))
		}

		if clusters[0].EntityId != clusterEast1ID {
			t.Errorf("expected cluster-east-1 (prod tier), got %s", clusters[0].EntityId)
		}
	})
}
