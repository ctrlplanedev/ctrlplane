package variables

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

// ===== Benchmark Helper Functions =====

func createBenchResource(workspaceID, id, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  name,
		Kind:        "service",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata: map[string]string{
			"region": "us-west-1",
			"tier":   "production",
		},
	}
}

func createBenchDeployment(systemID, id, name string) *oapi.Deployment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	description := fmt.Sprintf("Benchmark deployment %s", name)
	jobAgentID := uuid.New().String()
	return &oapi.Deployment{
		Id:               id,
		Name:             name,
		Slug:             name,
		SystemId:         systemID,
		Description:      &description,
		ResourceSelector: selector,
		JobAgentId:       &jobAgentID,
		JobAgentConfig:   map[string]any{},
	}
}

func createBenchReleaseTarget(envID, depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: envID,
		DeploymentId:  depID,
		ResourceId:    resID,
	}
}

// setupVariableBenchmark creates a variable manager with test data
func setupVariableBenchmark(
	b *testing.B,
	numDeploymentVariables int,
	numResourceVariables int,
	numDeploymentVariableValues int,
	useRelationships bool,
) (*Manager, *oapi.ReleaseTarget, *store.Store) {
	b.Helper()
	ctx := context.Background()
	workspaceID := "bench-workspace-" + uuid.New().String()
	cs := statechange.NewChangeSet[any]()
	st := store.New(workspaceID, cs)

	// Create a system
	systemID := uuid.New().String()
	environmentID := uuid.New().String()

	// Create main resource
	resourceID := uuid.New().String()
	resource := createBenchResource(workspaceID, resourceID, "main-service")
	resource.Metadata["tier"] = "production"
	resource.Metadata["region"] = "us-west-1"
	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		b.Fatalf("Failed to create resource: %v", err)
	}

	// Create deployment
	deploymentID := uuid.New().String()
	deployment := createBenchDeployment(systemID, deploymentID, "main-deployment")
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		b.Fatalf("Failed to create deployment: %v", err)
	}

	// Create deployment variables
	for i := 0; i < numDeploymentVariables; i++ {
		varID := uuid.New().String()
		key := fmt.Sprintf("var_%d", i)

		// Create default value
		defaultValue := &oapi.LiteralValue{}
		_ = defaultValue.FromStringValue(fmt.Sprintf("default_%d", i))

		deploymentVar := &oapi.DeploymentVariable{
			Id:           varID,
			Key:          key,
			DeploymentId: deploymentID,
			DefaultValue: defaultValue,
		}
		st.DeploymentVariables.Upsert(ctx, varID, deploymentVar)

		// Create deployment variable values with selectors
		for j := 0; j < numDeploymentVariableValues; j++ {
			valueID := uuid.New().String()

			// Create selector that matches based on tier and region
			var selector *oapi.Selector
			if j%3 == 0 {
				// Matches production tier
				selector = &oapi.Selector{}
				_ = selector.FromCelSelector(oapi.CelSelector{
					Cel: "resource.metadata.tier == 'production'",
				})
			} else if j%3 == 1 {
				// Matches specific region
				selector = &oapi.Selector{}
				_ = selector.FromCelSelector(oapi.CelSelector{
					Cel: "resource.metadata.region == 'us-west-1'",
				})
			} else {
				// Matches both
				selector = &oapi.Selector{}
				_ = selector.FromCelSelector(oapi.CelSelector{
					Cel: "resource.metadata.tier == 'production' && resource.metadata.region == 'us-west-1'",
				})
			}

			value := &oapi.Value{}
			_ = value.FromLiteralValue(oapi.LiteralValue{})
			literal := &oapi.LiteralValue{}
			_ = literal.FromStringValue(fmt.Sprintf("value_%d_%d", i, j))
			_ = value.FromLiteralValue(*literal)

			deploymentVarValue := &oapi.DeploymentVariableValue{
				Id:                   valueID,
				DeploymentVariableId: varID,
				Priority:             int64(numDeploymentVariableValues - j), // Higher priority for earlier values
				Value:                *value,
				ResourceSelector:     selector,
			}
			st.DeploymentVariableValues.Upsert(ctx, valueID, deploymentVarValue)
		}
	}

	// Create resource variables (overrides)
	for i := 0; i < numResourceVariables; i++ {
		key := fmt.Sprintf("var_%d", i) // Same keys as deployment variables

		value := &oapi.Value{}
		literal := &oapi.LiteralValue{}
		_ = literal.FromStringValue(fmt.Sprintf("resource_override_%d", i))
		_ = value.FromLiteralValue(*literal)

		resourceVar := &oapi.ResourceVariable{
			Key:        key,
			ResourceId: resourceID,
			Value:      *value,
		}
		st.ResourceVariables.Upsert(ctx, resourceVar)
	}

	// Setup relationships if requested
	if useRelationships {
		// Create a database resource
		dbID := uuid.New().String()
		dbResource := createBenchResource(workspaceID, dbID, "database")
		dbResource.Kind = "database"
		dbResource.Metadata["host"] = "db.example.com"
		dbResource.Metadata["port"] = "5432"
		if _, err := st.Resources.Upsert(ctx, dbResource); err != nil {
			b.Fatalf("Failed to create database resource: %v", err)
		}

		// Create relationship rule
		relRuleID := uuid.New().String()
		fromSelector := &oapi.Selector{}
		_ = fromSelector.FromJsonSelector(oapi.JsonSelector{
			Json: map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			},
		})
		toSelector := &oapi.Selector{}
		_ = toSelector.FromJsonSelector(oapi.JsonSelector{
			Json: map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			},
		})

		matcher := oapi.RelationshipRule_Matcher{}
		_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
			Properties: []oapi.PropertyMatcher{
				{
					FromProperty: []string{"metadata", "db_id"},
					ToProperty:   []string{"id"},
					Operator:     oapi.Equals,
				},
			},
		})

		relRule := &oapi.RelationshipRule{
			Id:               relRuleID,
			WorkspaceId:      workspaceID,
			Name:             "service-to-database",
			Reference:        "database",
			FromType:         "resource",
			ToType:           "resource",
			RelationshipType: "depends-on",
			FromSelector:     fromSelector,
			ToSelector:       toSelector,
			Matcher:          matcher,
			Metadata:         map[string]string{},
		}
		st.Relationships.Upsert(ctx, relRule)

		// Link resource to database
		resource.Metadata["db_id"] = dbID
		if _, err := st.Resources.Upsert(ctx, resource); err != nil {
			b.Fatalf("Failed to update resource with relationship: %v", err)
		}

		// Add a variable that references the database
		refVarID := uuid.New().String()
		refValue := &oapi.ReferenceValue{
			Reference: "database",
			Path:      []string{"metadata", "host"},
		}
		value := &oapi.Value{}
		_ = value.FromReferenceValue(*refValue)

		deploymentVar := &oapi.DeploymentVariable{
			Id:           refVarID,
			Key:          "db_host",
			DeploymentId: deploymentID,
		}
		st.DeploymentVariables.Upsert(ctx, refVarID, deploymentVar)

		// Add deployment variable value with reference
		refValueID := uuid.New().String()
		deploymentVarValue := &oapi.DeploymentVariableValue{
			Id:                   refValueID,
			DeploymentVariableId: refVarID,
			Priority:             1,
			Value:                *value,
		}
		st.DeploymentVariableValues.Upsert(ctx, refValueID, deploymentVarValue)
	}

	// Create release target
	releaseTarget := createBenchReleaseTarget(environmentID, deploymentID, resourceID)

	manager := New(st)

	b.Logf("Created %d deployment variables, %d resource variables, %d variable values per deployment var, relationships=%v",
		numDeploymentVariables, numResourceVariables, numDeploymentVariableValues, useRelationships)

	return manager, releaseTarget, st
}

// ===== Benchmarks =====

// BenchmarkEvaluate_10Variables_NoOverrides benchmarks basic variable evaluation
func BenchmarkEvaluate_10Variables_NoOverrides(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 10, 0, 1, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_50Variables_NoOverrides benchmarks with more variables
func BenchmarkEvaluate_50Variables_NoOverrides(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 0, 1, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_100Variables_NoOverrides benchmarks with many variables
func BenchmarkEvaluate_100Variables_NoOverrides(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 100, 0, 1, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_50Variables_25Overrides tests resource variable overrides
func BenchmarkEvaluate_50Variables_25Overrides(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 25, 1, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_50Variables_50Overrides tests all variables overridden
func BenchmarkEvaluate_50Variables_50Overrides(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 50, 1, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_50Variables_5Values tests multiple deployment variable values
func BenchmarkEvaluate_50Variables_5Values(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 0, 5, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_50Variables_10Values tests many deployment variable values with selector matching
func BenchmarkEvaluate_50Variables_10Values(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 0, 10, false)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_WithRelationships tests variable resolution with relationship references
func BenchmarkEvaluate_WithRelationships(b *testing.B) {
	manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 0, 1, true)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_ComplexScenario tests a realistic complex scenario
func BenchmarkEvaluate_ComplexScenario(b *testing.B) {
	// 100 variables, 30% overridden, 5 values per variable, with relationships
	manager, releaseTarget, _ := setupVariableBenchmark(b, 100, 30, 5, true)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_VaryingVariableCount benchmarks with different variable counts
func BenchmarkEvaluate_VaryingVariableCount(b *testing.B) {
	variableCounts := []int{10, 25, 50, 100, 200}

	for _, count := range variableCounts {
		b.Run(fmt.Sprintf("Variables_%d", count), func(b *testing.B) {
			manager, releaseTarget, _ := setupVariableBenchmark(b, count, 0, 1, false)
			ctx := context.Background()

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				_, err := manager.Evaluate(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("Evaluate failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkEvaluate_VaryingOverrideRatio benchmarks with different override ratios
func BenchmarkEvaluate_VaryingOverrideRatio(b *testing.B) {
	numVars := 50
	overrideRatios := []float64{0.0, 0.25, 0.5, 0.75, 1.0}

	for _, ratio := range overrideRatios {
		overrides := int(float64(numVars) * ratio)
		b.Run(fmt.Sprintf("Overrides_%.0f%%", ratio*100), func(b *testing.B) {
			manager, releaseTarget, _ := setupVariableBenchmark(b, numVars, overrides, 1, false)
			ctx := context.Background()

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				_, err := manager.Evaluate(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("Evaluate failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkEvaluate_VaryingValueCount benchmarks with different deployment variable value counts
func BenchmarkEvaluate_VaryingValueCount(b *testing.B) {
	valueCounts := []int{1, 3, 5, 10, 20}

	for _, count := range valueCounts {
		b.Run(fmt.Sprintf("Values_%d", count), func(b *testing.B) {
			manager, releaseTarget, _ := setupVariableBenchmark(b, 50, 0, count, false)
			ctx := context.Background()

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				_, err := manager.Evaluate(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("Evaluate failed: %v", err)
				}
			}
		})
	}
}

// setupLargeRelationshipBenchmark creates a benchmark with many resources and relationship rules
func setupLargeRelationshipBenchmark(b *testing.B, numResources int) (*Manager, *oapi.ReleaseTarget, *store.Store) {
	b.Helper()
	ctx := context.Background()
	workspaceID := "bench-workspace-" + uuid.New().String()
	cs := statechange.NewChangeSet[any]()
	st := store.New(workspaceID, cs)

	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()

	// Create deployment
	deployment := createBenchDeployment(systemID, deploymentID, "main-deployment")
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		b.Fatalf("Failed to create deployment: %v", err)
	}

	// Create database and VPC resources (targets for relationships)
	databaseIDs := make([]string, 0)
	vpcIDs := make([]string, 0)

	// Create 100 databases and 100 VPCs (10% each of total resources)
	numDatabases := numResources / 10
	numVPCs := numResources / 10
	numServices := numResources - numDatabases - numVPCs

	// Create databases
	for i := 0; i < numDatabases; i++ {
		dbID := uuid.New().String()
		dbResource := createBenchResource(workspaceID, dbID, fmt.Sprintf("database-%d", i))
		dbResource.Kind = "database"
		dbResource.Metadata["host"] = fmt.Sprintf("db-%d.example.com", i)
		dbResource.Metadata["port"] = "5432"
		dbResource.Metadata["connection_string"] = fmt.Sprintf("postgresql://db-%d.example.com:5432", i)
		if _, err := st.Resources.Upsert(ctx, dbResource); err != nil {
			b.Fatalf("Failed to create database resource: %v", err)
		}
		databaseIDs = append(databaseIDs, dbID)
	}

	// Create VPCs
	for i := 0; i < numVPCs; i++ {
		vpcID := uuid.New().String()
		vpcResource := createBenchResource(workspaceID, vpcID, fmt.Sprintf("vpc-%d", i))
		vpcResource.Kind = "vpc"
		vpcResource.Metadata["cidr"] = fmt.Sprintf("10.%d.0.0/16", i%256)
		vpcResource.Metadata["vpc_id"] = fmt.Sprintf("vpc-%s", vpcID[:8])
		if _, err := st.Resources.Upsert(ctx, vpcResource); err != nil {
			b.Fatalf("Failed to create VPC resource: %v", err)
		}
		vpcIDs = append(vpcIDs, vpcID)
	}

	// Create service resources that reference databases and VPCs
	serviceIDs := make([]string, 0)
	for i := 0; i < numServices; i++ {
		serviceID := uuid.New().String()
		serviceResource := createBenchResource(workspaceID, serviceID, fmt.Sprintf("service-%d", i))
		serviceResource.Kind = "service"
		serviceResource.Metadata["tier"] = []string{"frontend", "backend", "api"}[i%3]
		serviceResource.Metadata["region"] = []string{"us-east-1", "us-west-2", "eu-west-1"}[i%3]

		// Link to database and VPC
		if len(databaseIDs) > 0 {
			serviceResource.Metadata["db_id"] = databaseIDs[i%len(databaseIDs)]
		}
		if len(vpcIDs) > 0 {
			serviceResource.Metadata["vpc_id"] = vpcIDs[i%len(vpcIDs)]
		}

		if _, err := st.Resources.Upsert(ctx, serviceResource); err != nil {
			b.Fatalf("Failed to create service resource: %v", err)
		}
		serviceIDs = append(serviceIDs, serviceID)
	}

	// Create relationship rule 1: Service to Database
	dbRelRuleID := uuid.New().String()
	dbFromSelector := &oapi.Selector{}
	_ = dbFromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "service",
		},
	})
	dbToSelector := &oapi.Selector{}
	_ = dbToSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "database",
		},
	})

	dbMatcher := oapi.RelationshipRule_Matcher{}
	_ = dbMatcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "db_id"},
				ToProperty:   []string{"id"},
				Operator:     oapi.Equals,
			},
		},
	})

	dbRelRule := &oapi.RelationshipRule{
		Id:               dbRelRuleID,
		WorkspaceId:      workspaceID,
		Name:             "service-to-database",
		Reference:        "database",
		FromType:         "resource",
		ToType:           "resource",
		RelationshipType: "depends-on",
		FromSelector:     dbFromSelector,
		ToSelector:       dbToSelector,
		Matcher:          dbMatcher,
		Metadata:         map[string]string{},
	}
	st.Relationships.Upsert(ctx, dbRelRule)

	// Create relationship rule 2: Service to VPC
	vpcRelRuleID := uuid.New().String()
	vpcFromSelector := &oapi.Selector{}
	_ = vpcFromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "service",
		},
	})
	vpcToSelector := &oapi.Selector{}
	_ = vpcToSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		},
	})

	vpcMatcher := oapi.RelationshipRule_Matcher{}
	_ = vpcMatcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "vpc_id"},
				ToProperty:   []string{"id"},
				Operator:     oapi.Equals,
			},
		},
	})

	vpcRelRule := &oapi.RelationshipRule{
		Id:               vpcRelRuleID,
		WorkspaceId:      workspaceID,
		Name:             "service-to-vpc",
		Reference:        "vpc",
		FromType:         "resource",
		ToType:           "resource",
		RelationshipType: "depends-on",
		FromSelector:     vpcFromSelector,
		ToSelector:       vpcToSelector,
		Matcher:          vpcMatcher,
		Metadata:         map[string]string{},
	}
	st.Relationships.Upsert(ctx, vpcRelRule)

	// Create 10 deployment variables that use references
	referenceConfigs := []struct {
		key       string
		reference string
		path      []string
	}{
		{"db_host", "database", []string{"metadata", "host"}},
		{"db_port", "database", []string{"metadata", "port"}},
		{"db_connection_string", "database", []string{"metadata", "connection_string"}},
		{"db_name", "database", []string{"name"}},
		{"db_id", "database", []string{"id"}},
		{"vpc_id", "vpc", []string{"metadata", "vpc_id"}},
		{"vpc_cidr", "vpc", []string{"metadata", "cidr"}},
		{"vpc_name", "vpc", []string{"name"}},
		{"vpc_region", "vpc", []string{"metadata", "region"}},
		{"vpc_resource_id", "vpc", []string{"id"}},
	}

	for _, refConfig := range referenceConfigs {
		varID := uuid.New().String()
		refValue := &oapi.ReferenceValue{
			Reference: refConfig.reference,
			Path:      refConfig.path,
		}
		value := &oapi.Value{}
		_ = value.FromReferenceValue(*refValue)

		deploymentVar := &oapi.DeploymentVariable{
			Id:           varID,
			Key:          refConfig.key,
			DeploymentId: deploymentID,
		}
		st.DeploymentVariables.Upsert(ctx, varID, deploymentVar)

		// Add deployment variable value with reference
		valueID := uuid.New().String()
		deploymentVarValue := &oapi.DeploymentVariableValue{
			Id:                   valueID,
			DeploymentVariableId: varID,
			Priority:             1,
			Value:                *value,
		}
		st.DeploymentVariableValues.Upsert(ctx, valueID, deploymentVarValue)
	}

	// Use the first service resource for the release target
	var targetResourceID string
	if len(serviceIDs) > 0 {
		targetResourceID = serviceIDs[0]
	} else {
		b.Fatalf("No service resources created")
	}

	releaseTarget := createBenchReleaseTarget(environmentID, deploymentID, targetResourceID)

	manager := New(st)

	b.Logf("Created %d total resources (%d services, %d databases, %d VPCs), 2 relationship rules, 10 reference variables",
		numResources, numServices, numDatabases, numVPCs)

	return manager, releaseTarget, st
}

// BenchmarkEvaluate_10ReferenceVariables_2Rules_1000Resources benchmarks relationship resolution at scale
func BenchmarkEvaluate_10ReferenceVariables_2Rules_1000Resources(b *testing.B) {
	manager, releaseTarget, _ := setupLargeRelationshipBenchmark(b, 1000)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := manager.Evaluate(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}

// BenchmarkEvaluate_10ReferenceVariables_2Rules_VaryingResourceCount tests relationship resolution with varying resource counts
func BenchmarkEvaluate_10ReferenceVariables_2Rules_VaryingResourceCount(b *testing.B) {
	resourceCounts := []int{100, 500, 1000, 2000, 5000}

	for _, count := range resourceCounts {
		b.Run(fmt.Sprintf("Resources_%d", count), func(b *testing.B) {
			manager, releaseTarget, _ := setupLargeRelationshipBenchmark(b, count)
			ctx := context.Background()

			b.ResetTimer()
			b.ReportAllocs()

			for b.Loop() {
				_, err := manager.Evaluate(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("Evaluate failed: %v", err)
				}
			}
		})
	}
}

