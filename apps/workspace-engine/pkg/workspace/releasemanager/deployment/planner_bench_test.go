package deployment

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

// ===== Test Helper Functions =====

func createTestSystem(workspaceID, id, name string) *oapi.System {
	return &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

func createTestEnvironment(systemID, id, name string) *oapi.Environment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	description := fmt.Sprintf("Test environment %s", name)
	return &oapi.Environment{
		Id:               id,
		Name:             name,
		Description:      &description,
		ResourceSelector: selector,
		CreatedAt:        time.Now(),
	}
}

func createTestDeployment(_, systemID, id, name string) *oapi.Deployment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	description := fmt.Sprintf("Test deployment %s", name)
	jobAgentID := uuid.New().String()
	return &oapi.Deployment{
		Id:               id,
		Name:             name,
		Slug:             name,
		Description:      &description,
		ResourceSelector: selector,
		JobAgentId:       &jobAgentID,
		JobAgentConfig:   oapi.JobAgentConfig{},
	}
}

func createTestDeploymentVersion(id, deploymentID, tag string, status oapi.DeploymentVersionStatus) *oapi.DeploymentVersion {
	now := time.Now()
	return &oapi.DeploymentVersion{
		Id:             id,
		DeploymentId:   deploymentID,
		Tag:            tag,
		Name:           fmt.Sprintf("version-%s", tag),
		Status:         status,
		Config:         map[string]any{},
		JobAgentConfig: map[string]any{},
		CreatedAt:      now,
	}
}

func createTestResource(workspaceID, id, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  name,
		Kind:        "test-kind",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata: map[string]string{
			"region": "us-west-1",
			"env":    "test",
		},
	}
}

func createTestPolicy(id, workspaceID, name string) *oapi.Policy {
	now := time.Now().Format(time.RFC3339)
	return &oapi.Policy{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		CreatedAt:   now,
		Rules:       []oapi.PolicyRule{},
		Selector:    "true",
	}
}

func createTestReleaseTarget(envID, depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: envID,
		DeploymentId:  depID,
		ResourceId:    resID,
	}
}

// setupBenchmarkPlanner creates a fully configured planner with the specified number of entities
func setupBenchmarkPlanner(
	b *testing.B,
	workspaceID string,
	numResources, numDeployments, numEnvironments, numVersionsPerDeployment, numPolicies int,
) (*Planner, []*oapi.ReleaseTarget) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	if err := st.Systems.Upsert(ctx, sys); err != nil {
		b.Fatalf("Failed to create system: %v", err)
	}

	// Create resources
	resourceIDs := make([]string, numResources)
	for i := 0; i < numResources; i++ {
		resourceID := uuid.New().String()
		resourceIDs[i] = resourceID
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)

		// Add variety to metadata for realistic filtering
		res.Metadata["tier"] = []string{"frontend", "backend", "database"}[i%3]
		res.Metadata["region"] = []string{"us-east-1", "us-west-2", "eu-west-1"}[i%3]
		res.Metadata["priority"] = []string{"high", "medium", "low"}[i%3]

		if _, err := st.Resources.Upsert(ctx, res); err != nil {
			b.Fatalf("Failed to create resource: %v", err)
		}
	}

	// Create environments
	environmentIDs := make([]string, numEnvironments)
	for i := 0; i < numEnvironments; i++ {
		environmentID := uuid.New().String()
		environmentIDs[i] = environmentID
		envName := fmt.Sprintf("env-%d", i)
		env := createTestEnvironment(systemID, environmentID, envName)

		if err := st.Environments.Upsert(ctx, env); err != nil {
			b.Fatalf("Failed to create environment: %v", err)
		}
	}

	// Create deployments with versions
	deploymentIDs := make([]string, numDeployments)
	for i := 0; i < numDeployments; i++ {
		deploymentID := uuid.New().String()
		deploymentIDs[i] = deploymentID
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createTestDeployment(workspaceID, systemID, deploymentID, deploymentName)

		if err := st.Deployments.Upsert(ctx, dep); err != nil {
			b.Fatalf("Failed to create deployment: %v", err)
		}

		// Create versions for this deployment
		for v := 0; v < numVersionsPerDeployment; v++ {
			versionID := uuid.New().String()
			versionTag := fmt.Sprintf("v1.%d.%d", i, v)
			status := oapi.DeploymentVersionStatusReady

			// Make some versions building/failed for realism
			if v%5 == 0 {
				status = oapi.DeploymentVersionStatusBuilding
			} else if v%7 == 0 {
				status = oapi.DeploymentVersionStatusFailed
			}

			version := createTestDeploymentVersion(versionID, deploymentID, versionTag, status)
			st.DeploymentVersions.Upsert(ctx, versionID, version)
		}
	}

	// Create policies
	for i := 0; i < numPolicies; i++ {
		policyID := uuid.New().String()
		policyName := fmt.Sprintf("policy-%d", i)
		pol := createTestPolicy(policyID, workspaceID, policyName)

		// Add some policy rules for realism
		if i%2 == 0 && len(environmentIDs) >= 2 {
			// Environment progression rule
			ruleID := uuid.New().String()
			createdAt := time.Now().Format(time.RFC3339)

			// Create selector for dependency environment
			dependsOnSelector := &oapi.Selector{}
			_ = dependsOnSelector.FromCelSelector(oapi.CelSelector{
				Cel: fmt.Sprintf("environment.id == '%s'", environmentIDs[0]),
			})

			pol.Rules = append(pol.Rules, oapi.PolicyRule{
				Id:        ruleID,
				PolicyId:  policyID,
				CreatedAt: createdAt,
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: *dependsOnSelector,
				},
			})
		}

		st.Policies.Upsert(ctx, pol)
	}

	// Create planner with all managers
	policyManager := policy.New(st)
	versionManager := versions.New(st)
	variableManager := variables.New(st)
	planner := NewPlanner(st, policyManager, versionManager, variableManager)

	// Create release targets (one per resource x environment x deployment combination)
	// For large benchmarks, we'll just sample to avoid combinatorial explosion
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	maxTargets := 10000 // Cap at reasonable number for benchmarks

	for i := 0; i < numResources && len(releaseTargets) < maxTargets; i++ {
		for j := 0; j < numEnvironments && len(releaseTargets) < maxTargets; j++ {
			for k := 0; k < numDeployments && len(releaseTargets) < maxTargets; k++ {
				rt := createTestReleaseTarget(
					environmentIDs[j],
					deploymentIDs[k],
					resourceIDs[i],
				)
				releaseTargets = append(releaseTargets, rt)
			}
		}
	}

	return planner, releaseTargets
}

// ===== Sequential Benchmarks =====

// BenchmarkPlanDeployment_Sequential tests planning performance with varying dataset sizes
func BenchmarkPlanDeployment_Sequential(b *testing.B) {
	scenarios := []struct {
		name                     string
		numResources             int
		numDeployments           int
		numEnvironments          int
		numVersionsPerDeployment int
		numPolicies              int
	}{
		{"Tiny_1R_1D_1E_5V", 1, 1, 1, 5, 0},
		{"Small_10R_5D_3E_10V", 10, 5, 3, 10, 2},
		{"Medium_100R_10D_5E_20V", 100, 10, 5, 20, 5},
		{"Large_1000R_20D_10E_50V", 1000, 20, 10, 50, 10},
		{"XLarge_5000R_50D_20E_100V", 5000, 50, 20, 100, 20},
	}

	for _, scenario := range scenarios {
		b.Run(scenario.name, func(b *testing.B) {
			workspaceID := uuid.New().String()
			planner, releaseTargets := setupBenchmarkPlanner(
				b,
				workspaceID,
				scenario.numResources,
				scenario.numDeployments,
				scenario.numEnvironments,
				scenario.numVersionsPerDeployment,
				scenario.numPolicies,
			)

			if len(releaseTargets) == 0 {
				b.Skip("No release targets created")
			}

			// Use first release target for benchmark
			releaseTarget := releaseTargets[0]

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				_, err := planner.PlanDeployment(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("PlanDeployment failed: %v", err)
				}
			}
		})
	}
}

// ===== Parallel/Concurrent Benchmarks =====

// BenchmarkPlanDeployment_Parallel tests planning under high concurrency
func BenchmarkPlanDeployment_Parallel(b *testing.B) {
	scenarios := []struct {
		name                     string
		numResources             int
		numDeployments           int
		numEnvironments          int
		numVersionsPerDeployment int
		numPolicies              int
	}{
		{"Small_10R_5D_3E", 10, 5, 3, 10, 2},
		{"Medium_100R_10D_5E", 100, 10, 5, 20, 5},
		{"Large_1000R_20D_10E", 1000, 20, 10, 50, 10},
	}

	for _, scenario := range scenarios {
		b.Run(scenario.name, func(b *testing.B) {
			workspaceID := uuid.New().String()
			planner, releaseTargets := setupBenchmarkPlanner(
				b,
				workspaceID,
				scenario.numResources,
				scenario.numDeployments,
				scenario.numEnvironments,
				scenario.numVersionsPerDeployment,
				scenario.numPolicies,
			)

			if len(releaseTargets) == 0 {
				b.Skip("No release targets created")
			}

			b.ResetTimer()
			b.ReportAllocs()

			// RunParallel runs the benchmark with GOMAXPROCS goroutines
			b.RunParallel(func(pb *testing.PB) {
				targetIdx := 0
				for pb.Next() {
					ctx := context.Background()
					// Rotate through different release targets for variety
					releaseTarget := releaseTargets[targetIdx%len(releaseTargets)]
					targetIdx++

					_, err := planner.PlanDeployment(ctx, releaseTarget)
					if err != nil {
						b.Errorf("PlanDeployment failed: %v", err)
					}
				}
			})
		})
	}
}

// BenchmarkPlanDeployment_HighConcurrency tests with explicit high concurrency levels
func BenchmarkPlanDeployment_HighConcurrency(b *testing.B) {
	workspaceID := uuid.New().String()
	planner, releaseTargets := setupBenchmarkPlanner(
		b,
		workspaceID,
		1000, // resources
		20,   // deployments
		10,   // environments
		50,   // versions per deployment
		10,   // policies
	)

	if len(releaseTargets) == 0 {
		b.Skip("No release targets created")
	}

	concurrencyLevels := []int{1, 10, 50, 100, 500, 1000}

	for _, concurrency := range concurrencyLevels {
		b.Run(fmt.Sprintf("Concurrent_%d", concurrency), func(b *testing.B) {
			b.ResetTimer()
			b.ReportAllocs()

			var wg sync.WaitGroup
			errChan := make(chan error, concurrency)

			for i := 0; i < b.N; i++ {
				// Run operations in batches of 'concurrency'
				for c := 0; c < concurrency; c++ {
					wg.Add(1)
					go func(idx int) {
						defer wg.Done()
						ctx := context.Background()
						releaseTarget := releaseTargets[idx%len(releaseTargets)]
						_, err := planner.PlanDeployment(ctx, releaseTarget)
						if err != nil {
							select {
							case errChan <- err:
							default:
							}
						}
					}(i*concurrency + c)
				}
				wg.Wait()

				// Check for errors
				select {
				case err := <-errChan:
					b.Fatalf("PlanDeployment failed: %v", err)
				default:
				}
			}
		})
	}
}

// BenchmarkPlanDeployment_ManyVersions tests with large numbers of candidate versions
func BenchmarkPlanDeployment_ManyVersions(b *testing.B) {
	versionCounts := []int{10, 50, 100, 500, 1000}

	for _, versionCount := range versionCounts {
		b.Run(fmt.Sprintf("Versions_%d", versionCount), func(b *testing.B) {
			workspaceID := uuid.New().String()
			planner, releaseTargets := setupBenchmarkPlanner(
				b,
				workspaceID,
				100, // resources
				5,   // deployments
				3,   // environments
				versionCount,
				5, // policies
			)

			if len(releaseTargets) == 0 {
				b.Skip("No release targets created")
			}

			releaseTarget := releaseTargets[0]

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				_, err := planner.PlanDeployment(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("PlanDeployment failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkPlanDeployment_ComplexPolicies tests with many complex policies
func BenchmarkPlanDeployment_ComplexPolicies(b *testing.B) {
	policyCounts := []int{0, 5, 10, 25, 50, 100}

	for _, policyCount := range policyCounts {
		b.Run(fmt.Sprintf("Policies_%d", policyCount), func(b *testing.B) {
			workspaceID := uuid.New().String()
			planner, releaseTargets := setupBenchmarkPlanner(
				b,
				workspaceID,
				100, // resources
				10,  // deployments
				5,   // environments
				20,  // versions per deployment
				policyCount,
			)

			if len(releaseTargets) == 0 {
				b.Skip("No release targets created")
			}

			releaseTarget := releaseTargets[0]

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				_, err := planner.PlanDeployment(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("PlanDeployment failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkPlanDeployment_MultipleTargets tests planning across many different release targets
func BenchmarkPlanDeployment_MultipleTargets(b *testing.B) {
	workspaceID := uuid.New().String()
	planner, releaseTargets := setupBenchmarkPlanner(
		b,
		workspaceID,
		1000, // resources
		20,   // deployments
		10,   // environments
		50,   // versions per deployment
		10,   // policies
	)

	if len(releaseTargets) == 0 {
		b.Skip("No release targets created")
	}

	b.Logf("Testing with %d release targets", len(releaseTargets))

	b.ResetTimer()
	b.ReportAllocs()

	// Cycle through all release targets
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		releaseTarget := releaseTargets[i%len(releaseTargets)]
		_, err := planner.PlanDeployment(ctx, releaseTarget)
		if err != nil {
			b.Fatalf("PlanDeployment failed: %v", err)
		}
	}
}

// BenchmarkPlanDeployment_Parallel_MultipleTargets combines high concurrency with target variety
func BenchmarkPlanDeployment_Parallel_MultipleTargets(b *testing.B) {
	workspaceID := uuid.New().String()
	planner, releaseTargets := setupBenchmarkPlanner(
		b,
		workspaceID,
		1000, // resources
		20,   // deployments
		10,   // environments
		50,   // versions per deployment
		10,   // policies
	)

	if len(releaseTargets) == 0 {
		b.Skip("No release targets created")
	}

	b.Logf("Testing with %d release targets in parallel", len(releaseTargets))

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		targetIdx := 0
		for pb.Next() {
			ctx := context.Background()
			releaseTarget := releaseTargets[targetIdx%len(releaseTargets)]
			targetIdx++

			_, err := planner.PlanDeployment(ctx, releaseTarget)
			if err != nil {
				b.Errorf("PlanDeployment failed: %v", err)
			}
		}
	})
}

// BenchmarkPlanDeployment_Stress tests extreme concurrency stress scenario
func BenchmarkPlanDeployment_Stress(b *testing.B) {
	workspaceID := uuid.New().String()
	planner, releaseTargets := setupBenchmarkPlanner(
		b,
		workspaceID,
		5000, // resources
		50,   // deployments
		20,   // environments
		100,  // versions per deployment
		25,   // policies
	)

	if len(releaseTargets) == 0 {
		b.Skip("No release targets created")
	}

	b.Logf("Stress test with %d release targets", len(releaseTargets))

	concurrency := 2000 // Very high concurrency

	b.ResetTimer()
	b.ReportAllocs()

	var wg sync.WaitGroup
	sem := make(chan struct{}, concurrency)

	for i := 0; i < b.N*100; i++ { // 100x operations per iteration
		wg.Add(1)
		sem <- struct{}{} // Acquire semaphore

		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }() // Release semaphore

			ctx := context.Background()
			releaseTarget := releaseTargets[idx%len(releaseTargets)]
			_, _ = planner.PlanDeployment(ctx, releaseTarget)
		}(i)
	}

	wg.Wait()
}

// BenchmarkPlanDeployment_Contention tests lock contention with shared resources
func BenchmarkPlanDeployment_Contention(b *testing.B) {
	workspaceID := uuid.New().String()
	planner, releaseTargets := setupBenchmarkPlanner(
		b,
		workspaceID,
		100, // fewer resources to increase contention
		5,   // fewer deployments
		3,   // fewer environments
		50,  // many versions
		10,  // policies
	)

	if len(releaseTargets) == 0 {
		b.Skip("No release targets created")
	}

	// Use only first few targets to force contention on same data
	contentionTargets := releaseTargets
	if len(contentionTargets) > 10 {
		contentionTargets = releaseTargets[:10]
	}

	b.Logf("Testing contention with %d targets", len(contentionTargets))

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		targetIdx := 0
		for pb.Next() {
			ctx := context.Background()
			// High contention: same targets accessed repeatedly
			releaseTarget := contentionTargets[targetIdx%len(contentionTargets)]
			targetIdx++

			_, err := planner.PlanDeployment(ctx, releaseTarget)
			if err != nil {
				b.Errorf("PlanDeployment failed: %v", err)
			}
		}
	})
}

// ===== Benchmarks with Variables and Relationships =====

// setupPlannerWithVariables creates a planner with deployment and resource variables
func setupPlannerWithVariables(
	b *testing.B,
	workspaceID string,
	numResources, numDeployments, numEnvironments int,
	numVariablesPerDeployment, numValuesPerVariable int,
) (*Planner, []*oapi.ReleaseTarget) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	if err := st.Systems.Upsert(ctx, sys); err != nil {
		b.Fatalf("Failed to create system: %v", err)
	}

	// Create resources with resource variables
	resourceIDs := make([]string, numResources)
	for i := 0; i < numResources; i++ {
		resourceID := uuid.New().String()
		resourceIDs[i] = resourceID
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)
		res.Metadata["tier"] = []string{"frontend", "backend", "database"}[i%3]
		res.Metadata["region"] = []string{"us-east-1", "us-west-2", "eu-west-1"}[i%3]

		if _, err := st.Resources.Upsert(ctx, res); err != nil {
			b.Fatalf("Failed to create resource: %v", err)
		}

		// Add resource variables (these override deployment variables)
		if i%3 == 0 {
			// Add some resource-specific variable overrides
			for v := 0; v < 3; v++ {
				stringVal := fmt.Sprintf("resource-%d-value-%d", i, v)

				// Create value
				value := &oapi.Value{}
				literalValue := &oapi.LiteralValue{}
				_ = literalValue.FromStringValue(stringVal)
				_ = value.FromLiteralValue(*literalValue)

				rv := &oapi.ResourceVariable{
					ResourceId: resourceID,
					Key:        fmt.Sprintf("var_%d", v),
					Value:      *value,
				}
				st.ResourceVariables.Upsert(ctx, rv)
			}
		}
	}

	// Create environments
	environmentIDs := make([]string, numEnvironments)
	for i := 0; i < numEnvironments; i++ {
		environmentID := uuid.New().String()
		environmentIDs[i] = environmentID
		envName := fmt.Sprintf("env-%d", i)
		env := createTestEnvironment(systemID, environmentID, envName)
		if err := st.Environments.Upsert(ctx, env); err != nil {
			b.Fatalf("Failed to create environment: %v", err)
		}
	}

	// Create deployments with variables and versions
	deploymentIDs := make([]string, numDeployments)
	for i := 0; i < numDeployments; i++ {
		deploymentID := uuid.New().String()
		deploymentIDs[i] = deploymentID
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createTestDeployment(workspaceID, systemID, deploymentID, deploymentName)

		if err := st.Deployments.Upsert(ctx, dep); err != nil {
			b.Fatalf("Failed to create deployment: %v", err)
		}

		// Create deployment variables
		for v := 0; v < numVariablesPerDeployment; v++ {
			dvID := uuid.New().String()
			varKey := fmt.Sprintf("var_%d", v)
			defaultVal := fmt.Sprintf("default-value-%d", v)

			// Create default literal value
			defaultLiteralValue := &oapi.LiteralValue{}
			_ = defaultLiteralValue.FromStringValue(defaultVal)

			dv := &oapi.DeploymentVariable{
				Id:           dvID,
				Key:          varKey,
				DeploymentId: deploymentID,
				DefaultValue: defaultLiteralValue,
			}
			st.DeploymentVariables.Upsert(ctx, dvID, dv)

			// Create deployment variable values with resource selectors
			for val := 0; val < numValuesPerVariable; val++ {
				dvvID := uuid.New().String()
				priority := int64(val + 1)
				value := fmt.Sprintf("value-%d-%d", v, val)

				// Create selector that matches certain resources
				var selector *oapi.Selector
				if val%2 == 0 {
					selector = &oapi.Selector{}
					_ = selector.FromJsonSelector(oapi.JsonSelector{
						Json: map[string]any{
							"type":     "metadata",
							"operator": "equals",
							"key":      "tier",
							"value":    []string{"frontend", "backend", "database"}[val%3],
						},
					})
				}

				// Create value
				valValue := &oapi.Value{}
				valLiteralValue := &oapi.LiteralValue{}
				_ = valLiteralValue.FromStringValue(value)
				_ = valValue.FromLiteralValue(*valLiteralValue)

				dvv := &oapi.DeploymentVariableValue{
					Id:                   dvvID,
					DeploymentVariableId: dvID,
					Priority:             priority,
					ResourceSelector:     selector,
					Value:                *valValue,
				}
				st.DeploymentVariableValues.Upsert(ctx, dvvID, dvv)
			}
		}

		// Create version for this deployment
		versionID := uuid.New().String()
		version := createTestDeploymentVersion(versionID, deploymentID, "v1.0.0", oapi.DeploymentVersionStatusReady)
		st.DeploymentVersions.Upsert(ctx, versionID, version)
	}

	// Create planner
	policyManager := policy.New(st)
	versionManager := versions.New(st)
	variableManager := variables.New(st)
	planner := NewPlanner(st, policyManager, versionManager, variableManager)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	maxTargets := 1000

	for i := 0; i < numResources && len(releaseTargets) < maxTargets; i++ {
		for j := 0; j < numEnvironments && len(releaseTargets) < maxTargets; j++ {
			for k := 0; k < numDeployments && len(releaseTargets) < maxTargets; k++ {
				rt := createTestReleaseTarget(
					environmentIDs[j],
					deploymentIDs[k],
					resourceIDs[i],
				)
				releaseTargets = append(releaseTargets, rt)
			}
		}
	}

	return planner, releaseTargets
}

// BenchmarkPlanDeployment_WithVariables tests planning with variable resolution
func BenchmarkPlanDeployment_WithVariables(b *testing.B) {
	scenarios := []struct {
		name                      string
		numResources              int
		numDeployments            int
		numEnvironments           int
		numVariablesPerDeployment int
		numValuesPerVariable      int
	}{
		{"Small_10R_2D_2E_5Vars_3Values", 10, 2, 2, 5, 3},
		{"Medium_50R_5D_3E_10Vars_5Values", 50, 5, 3, 10, 5},
		{"Large_100R_10D_5E_20Vars_10Values", 100, 10, 5, 20, 10},
	}

	for _, scenario := range scenarios {
		b.Run(scenario.name, func(b *testing.B) {
			workspaceID := uuid.New().String()
			planner, releaseTargets := setupPlannerWithVariables(
				b,
				workspaceID,
				scenario.numResources,
				scenario.numDeployments,
				scenario.numEnvironments,
				scenario.numVariablesPerDeployment,
				scenario.numValuesPerVariable,
			)

			if len(releaseTargets) == 0 {
				b.Skip("No release targets created")
			}

			releaseTarget := releaseTargets[0]

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				release, err := planner.PlanDeployment(ctx, releaseTarget)
				if err != nil {
					b.Fatalf("PlanDeployment failed: %v", err)
				}
				// Verify variables were resolved
				if i == 0 && release != nil && len(release.Variables) == 0 {
					b.Logf("Warning: No variables resolved")
				}
			}
		})
	}
}

// BenchmarkPlanDeployment_WithVariables_Parallel tests parallel planning with variables
func BenchmarkPlanDeployment_WithVariables_Parallel(b *testing.B) {
	workspaceID := uuid.New().String()
	planner, releaseTargets := setupPlannerWithVariables(
		b,
		workspaceID,
		100, // resources
		5,   // deployments
		3,   // environments
		10,  // variables per deployment
		5,   // values per variable
	)

	if len(releaseTargets) == 0 {
		b.Skip("No release targets created")
	}

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		targetIdx := 0
		for pb.Next() {
			ctx := context.Background()
			releaseTarget := releaseTargets[targetIdx%len(releaseTargets)]
			targetIdx++

			_, err := planner.PlanDeployment(ctx, releaseTarget)
			if err != nil {
				b.Errorf("PlanDeployment failed: %v", err)
			}
		}
	})
}
