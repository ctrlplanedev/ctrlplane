package store

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/google/uuid"
)

// createTestDeployment creates a test deployment
func createTestDeployment(workspaceID, systemID, deploymentID, name string) *oapi.Deployment {
	description := fmt.Sprintf("Test deployment %s", name)
	return &oapi.Deployment{
		Id:             deploymentID,
		SystemId:       systemID,
		Name:           name,
		Slug:           name,
		Description:    &description,
		JobAgentConfig: make(map[string]any),
	}
}

// createTestRelationshipRule creates a test relationship rule with a CEL matcher
func createTestRelationshipRule(id, reference, workspaceID, relType string, fromType, toType oapi.RelatableEntityType, celExpression string) *oapi.RelationshipRule {
	matcher := oapi.RelationshipRule_Matcher{}
	_ = matcher.FromCelMatcher(oapi.CelMatcher{Cel: celExpression})

	return &oapi.RelationshipRule{
		Id:               id,
		Reference:        reference,
		Name:             fmt.Sprintf("Rule %s", reference),
		RelationshipType: relType,
		FromType:         fromType,
		ToType:           toType,
		Matcher:          matcher,
		Metadata:         map[string]string{},
		WorkspaceId:      workspaceID,
	}
}

// setupRelationshipBenchmarkStore creates a store with test data for relationship benchmarks
func setupRelationshipBenchmarkStore(
	b *testing.B,
	workspaceID string,
	numResources, numDeployments, numEnvironments, numRules int,
) *Store {
	cs := statechange.NewChangeSet[any]()
	st := New(cs)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create resources
	for i := 0; i < numResources; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)

		// Add variety to metadata
		res.Metadata["tier"] = []string{"frontend", "backend", "database"}[i%3]
		res.Metadata["region"] = []string{"us-east-1", "us-west-2", "eu-west-1"}[i%3]
		res.Metadata["env"] = []string{"dev", "staging", "prod"}[i%3]

		st.repo.Resources.Set(resourceID, res)
	}

	// Create deployments
	for i := range numDeployments {
		deploymentID := uuid.New().String()
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createTestDeployment(workspaceID, systemID, deploymentID, deploymentName)
		st.repo.Deployments.Set(deploymentID, dep)
	}

	// Create environments
	for i := range numEnvironments {
		environmentID := uuid.New().String()
		environmentName := fmt.Sprintf("environment-%d", i)
		env := createTestEnvironment(systemID, environmentID, environmentName)
		st.repo.Environments.Set(environmentID, env)
	}

	// Create relationship rules with simple matchers
	for i := 0; i < numRules; i++ {
		ruleID := uuid.New().String()
		reference := fmt.Sprintf("rule-%d", i)

		// Vary the entity types for rules
		var fromType, toType oapi.RelatableEntityType
		switch i % 6 {
		case 0:
			fromType, toType = "resource", "deployment"
		case 1:
			fromType, toType = "deployment", "resource"
		case 2:
			fromType, toType = "resource", "environment"
		case 3:
			fromType, toType = "environment", "resource"
		case 4:
			fromType, toType = "deployment", "environment"
		case 5:
			fromType, toType = "environment", "deployment"
		}

		rule := createTestRelationshipRule(
			ruleID,
			reference,
			workspaceID,
			fmt.Sprintf("relationship-type-%d", i%3),
			fromType,
			toType,
			"true", // CEL expression that always matches
		)

		st.repo.RelationshipRules.Set(ruleID, rule)
	}

	return st
}

// BenchmarkGetRelatedEntities_VaryingResources benchmarks with varying numbers of resources
func BenchmarkGetRelatedEntities_VaryingResources(b *testing.B) {
	workspaceID := uuid.New().String()
	resourceCounts := []int{10, 50, 100, 500, 1000}

	for _, count := range resourceCounts {
		b.Run(fmt.Sprintf("resources_%d", count), func(b *testing.B) {
			st := setupRelationshipBenchmarkStore(b, workspaceID, count, 10, 5, 3)

			// Get a test resource to query relationships for
			var testResource *oapi.Resource
			for _, res := range st.Resources.Items() {
				testResource = res
				break
			}

			if testResource == nil {
				b.Fatal("No test resource found")
			}

			entity := relationships.NewResourceEntity(testResource)
			ctx := context.Background()

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := st.Relationships.GetRelatedEntities(ctx, entity)
				if err != nil {
					b.Fatalf("GetRelatedEntities failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkGetRelatedEntities_VaryingRules benchmarks with varying numbers of relationship rules
func BenchmarkGetRelatedEntities_VaryingRules(b *testing.B) {
	workspaceID := uuid.New().String()
	ruleCounts := []int{1, 5, 10, 25, 50}

	for _, count := range ruleCounts {
		b.Run(fmt.Sprintf("rules_%d", count), func(b *testing.B) {
			st := setupRelationshipBenchmarkStore(b, workspaceID, 100, 20, 10, count)

			// Get a test resource
			var testResource *oapi.Resource
			for _, res := range st.Resources.Items() {
				testResource = res
				break
			}

			if testResource == nil {
				b.Fatal("No test resource found")
			}

			entity := relationships.NewResourceEntity(testResource)
			ctx := context.Background()

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := st.Relationships.GetRelatedEntities(ctx, entity)
				if err != nil {
					b.Fatalf("GetRelatedEntities failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkGetRelatedEntities_DifferentEntityTypes benchmarks with different entity types
func BenchmarkGetRelatedEntities_DifferentEntityTypes(b *testing.B) {
	workspaceID := uuid.New().String()

	testCases := []struct {
		name         string
		getEntity    func(*Store) *oapi.RelatableEntity
		entityExists func(*Store) bool
	}{
		{
			name: "resource",
			getEntity: func(st *Store) *oapi.RelatableEntity {
				for _, res := range st.Resources.Items() {
					return relationships.NewResourceEntity(res)
				}
				return nil
			},
			entityExists: func(st *Store) bool {
				return len(st.Resources.Items()) > 0
			},
		},
		{
			name: "deployment",
			getEntity: func(st *Store) *oapi.RelatableEntity {
				for _, dep := range st.Deployments.Items() {
					return relationships.NewDeploymentEntity(dep)
				}
				return nil
			},
			entityExists: func(st *Store) bool {
				return len(st.Deployments.Items()) > 0
			},
		},
		{
			name: "environment",
			getEntity: func(st *Store) *oapi.RelatableEntity {
				for _, env := range st.Environments.Items() {
					return relationships.NewEnvironmentEntity(env)
				}
				return nil
			},
			entityExists: func(st *Store) bool {
				return len(st.Environments.Items()) > 0
			},
		},
	}

	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			st := setupRelationshipBenchmarkStore(b, workspaceID, 100, 50, 20, 10)

			if !tc.entityExists(st) {
				b.Skip("Entity type not available in store")
			}

			entity := tc.getEntity(st)
			if entity == nil {
				b.Fatal("Could not get test entity")
			}

			ctx := context.Background()

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_, err := st.Relationships.GetRelatedEntities(ctx, entity)
				if err != nil {
					b.Fatalf("GetRelatedEntities failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkGetRelatedEntities_WithSelectors benchmarks with selective matchers
func BenchmarkGetRelatedEntities_WithSelectors(b *testing.B) {
	workspaceID := uuid.New().String()
	ctx := context.Background()

	cs := statechange.NewChangeSet[any]()
	st := New(cs)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create resources with varying metadata
	for i := 0; i < 500; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)
		res.Metadata["tier"] = []string{"frontend", "backend", "database"}[i%3]
		st.repo.Resources.Set(resourceID, res)
	}

	// Create deployments
	for i := 0; i < 100; i++ {
		deploymentID := uuid.New().String()
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createTestDeployment(workspaceID, systemID, deploymentID, deploymentName)
		st.repo.Deployments.Set(deploymentID, dep)
	}

	// Create relationship rule with a selective matcher (only frontend tier)
	ruleID := uuid.New().String()
	rule := createTestRelationshipRule(
		ruleID,
		"frontend-rule",
		workspaceID,
		"depends-on",
		"resource",
		"deployment",
		"to.metadata.tier == 'frontend'",
	)
	st.repo.RelationshipRules.Set(ruleID, rule)

	// Get a frontend resource
	var testResource *oapi.Resource
	for _, res := range st.Resources.Items() {
		if res.Metadata["tier"] == "frontend" {
			testResource = res
			break
		}
	}

	if testResource == nil {
		b.Fatal("No frontend resource found")
	}

	entity := relationships.NewResourceEntity(testResource)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := st.Relationships.GetRelatedEntities(ctx, entity)
		if err != nil {
			b.Fatalf("GetRelatedEntities failed: %v", err)
		}
	}
}

// BenchmarkGetRelatedEntities_Parallel benchmarks concurrent calls
func BenchmarkGetRelatedEntities_Parallel(b *testing.B) {
	workspaceID := uuid.New().String()
	st := setupRelationshipBenchmarkStore(b, workspaceID, 500, 100, 50, 10)

	// Get a test resource
	var testResource *oapi.Resource
	for _, res := range st.Resources.Items() {
		testResource = res
		break
	}

	if testResource == nil {
		b.Fatal("No test resource found")
	}

	entity := relationships.NewResourceEntity(testResource)

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		ctx := context.Background()
		for pb.Next() {
			_, err := st.Relationships.GetRelatedEntities(ctx, entity)
			if err != nil {
				b.Fatalf("GetRelatedEntities failed: %v", err)
			}
		}
	})
}

// BenchmarkGetRelatedEntities_MemoryAllocation benchmarks memory allocations
func BenchmarkGetRelatedEntities_MemoryAllocation(b *testing.B) {
	workspaceID := uuid.New().String()
	st := setupRelationshipBenchmarkStore(b, workspaceID, 1000, 200, 100, 20)

	// Get a test resource
	var testResource *oapi.Resource
	for _, res := range st.Resources.Items() {
		testResource = res
		break
	}

	if testResource == nil {
		b.Fatal("No test resource found")
	}

	entity := relationships.NewResourceEntity(testResource)
	ctx := context.Background()

	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		_, err := st.Relationships.GetRelatedEntities(ctx, entity)
		if err != nil {
			b.Fatalf("GetRelatedEntities failed: %v", err)
		}
	}
}

// BenchmarkGetRelatedEntities_ManyMatches benchmarks when many relationships match
func BenchmarkGetRelatedEntities_ManyMatches(b *testing.B) {
	workspaceID := uuid.New().String()
	ctx := context.Background()

	cs := statechange.NewChangeSet[any]()
	st := New(cs)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create many resources
	for i := 0; i < 1000; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)
		st.repo.Resources.Set(resourceID, res)
	}

	// Create many deployments
	for i := 0; i < 1000; i++ {
		deploymentID := uuid.New().String()
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createTestDeployment(workspaceID, systemID, deploymentID, deploymentName)
		st.repo.Deployments.Set(deploymentID, dep)
	}

	// Create a rule that matches everything (no selectors, matcher always true)
	ruleID := uuid.New().String()
	rule := createTestRelationshipRule(
		ruleID,
		"match-all",
		workspaceID,
		"related-to",
		"resource",
		"deployment",
		"true",
	)
	st.repo.RelationshipRules.Set(ruleID, rule)

	// Get first resource
	var testResource *oapi.Resource
	for _, res := range st.Resources.Items() {
		testResource = res
		break
	}

	if testResource == nil {
		b.Fatal("No test resource found")
	}

	entity := relationships.NewResourceEntity(testResource)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		result, err := st.Relationships.GetRelatedEntities(ctx, entity)
		if err != nil {
			b.Fatalf("GetRelatedEntities failed: %v", err)
		}

		// Verify we got many results (only on first iteration to avoid overhead)
		if i == 0 {
			totalRelations := 0
			for _, relations := range result {
				totalRelations += len(relations)
			}
			if totalRelations < 100 {
				b.Logf("Expected many relationships, got %d", totalRelations)
			}
		}
	}
}

// BenchmarkGetRelatedEntities_NoMatches benchmarks when no relationships match
func BenchmarkGetRelatedEntities_NoMatches(b *testing.B) {
	workspaceID := uuid.New().String()
	ctx := context.Background()

	cs := statechange.NewChangeSet[any]()
	st := New(cs)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create resources
	for i := 0; i < 500; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)
		st.repo.Resources.Set(resourceID, res)
	}

	// Create deployments
	for i := 0; i < 100; i++ {
		deploymentID := uuid.New().String()
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createTestDeployment(workspaceID, systemID, deploymentID, deploymentName)
		st.repo.Deployments.Set(deploymentID, dep)
	}

	// Create a rule that never matches (matcher always false)
	ruleID := uuid.New().String()
	rule := createTestRelationshipRule(
		ruleID,
		"match-none",
		workspaceID,
		"related-to",
		"resource",
		"deployment",
		"false",
	)
	st.repo.RelationshipRules.Set(ruleID, rule)

	// Get first resource
	var testResource *oapi.Resource
	for _, res := range st.Resources.Items() {
		testResource = res
		break
	}

	if testResource == nil {
		b.Fatal("No test resource found")
	}

	entity := relationships.NewResourceEntity(testResource)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := st.Relationships.GetRelatedEntities(ctx, entity)
		if err != nil {
			b.Fatalf("GetRelatedEntities failed: %v", err)
		}
	}
}
