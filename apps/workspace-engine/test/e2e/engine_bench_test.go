package e2e

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/events/handler/tick"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Tunable parameters for BenchmarkEngine_LargeScale.
const (
	benchResourceCount     = 1000
	benchEnvironmentCount  = 5
	benchDeploymentCount   = 5
	benchVarsPerDeployment = 0
	benchValuesPerVariable = 0
	benchVersionsPerDeploy = 5
	benchTargetJobCount    = 50
	benchMaxProcessRounds  = 20
	benchJobBatchSize      = 50
)

// BenchmarkEngine_LargeScale benchmarks workspace.tick performance with a large-scale setup.
func BenchmarkEngine_LargeScale(b *testing.B) {
	b.Log("Setting up large-scale benchmark environment...")

	// Create test workspace using nil testing.T (allowed by NewTestWorkspace)
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Phase 1: Create job agents
	b.Log("Creating job agents...")
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(workspaceID)
	jobAgent.Id = jobAgentID
	jobAgent.Name = "Benchmark Job Agent"
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Phase 2: Create system
	b.Log("Creating system...")
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	sys.Name = "bench-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Phase 3: Create environments
	b.Log("Creating environments...")
	environmentIDs := make([]string, benchEnvironmentCount)
	for i := 0; i < benchEnvironmentCount; i++ {
		envID := uuid.New().String()
		environmentIDs[i] = envID
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = fmt.Sprintf("env-%d", i)
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		engine.PushEnvironmentCreateWithLink(ctx, sysID, env)
	}

	// Phase 4: Create deployments with variables
	b.Logf("Creating %d deployments with variables...", benchDeploymentCount)
	deploymentIDs := make([]string, benchDeploymentCount)
	for i := range benchDeploymentCount {
		deploymentID := uuid.New().String()
		deploymentIDs[i] = deploymentID

		deployment := c.NewDeployment(sysID)
		deployment.Id = deploymentID
		deployment.Name = fmt.Sprintf("deployment-%d", i)
		deployment.JobAgentId = &jobAgentID
		deployment.ResourceSelector = &oapi.Selector{}
		_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		deployment.JobAgentConfig = map[string]any{
			"namespace": fmt.Sprintf("ns-%d", i),
			"cluster":   fmt.Sprintf("cluster-%d", i%5),
		}
		engine.PushDeploymentCreateWithLink(ctx, sysID, deployment)

		for v := range benchVarsPerDeployment {
			dvID := uuid.New().String()
			dv := c.NewDeploymentVariable(deploymentID, fmt.Sprintf("var_%d", v))
			dv.Id = dvID

			// Set default literal value
			defaultVal := fmt.Sprintf("default-value-%d-%d", i, v)
			defaultLiteralValue := &oapi.LiteralValue{}
			_ = defaultLiteralValue.FromStringValue(defaultVal)
			dv.DefaultValue = defaultLiteralValue

			engine.PushEvent(ctx, handler.DeploymentVariableCreate, dv)

			for val := 0; val < benchValuesPerVariable; val++ {
				dvvID := uuid.New().String()
				dvv := &oapi.DeploymentVariableValue{
					Id:                   dvvID,
					DeploymentVariableId: dvID,
					Priority:             int64(val + 1),
				}

				// Add resource selector for some values
				if val > 0 {
					tierValue := []string{"frontend", "backend", "database"}[val%3]
					dvv.ResourceSelector = &oapi.Selector{}
					_ = dvv.ResourceSelector.FromCelSelector(oapi.CelSelector{
						Cel: fmt.Sprintf("metadata.tier == '%s'", tierValue),
					})
				}

				// Create value
				valValue := &oapi.Value{}
				valLiteralValue := &oapi.LiteralValue{}
				_ = valLiteralValue.FromStringValue(fmt.Sprintf("value-%d-%d-%d", i, v, val))
				_ = valValue.FromLiteralValue(*valLiteralValue)
				dvv.Value = *valValue

				engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, dvv)
			}
		}
	}

	// Phase 5: Create relationship rules
	b.Log("Creating relationship rules...")
	relationshipTypes := []struct {
		fromKind  string
		toKind    string
		reference string
	}{
		{"application", "database", "database"},
		{"application", "cache", "cache"},
		{"service", "vpc", "vpc"},
		{"cluster", "region", "region"},
		{"deployment", "config", "config"},
	}

	for _, relType := range relationshipTypes {
		rrID := uuid.New().String()
		rr := c.NewRelationshipRule(workspaceID)
		rr.Id = rrID
		rr.Name = fmt.Sprintf("%s-to-%s", relType.fromKind, relType.toKind)
		rr.Reference = relType.reference
		rr.FromType = "resource"
		rr.ToType = "resource"

		// From selector - use CEL
		rr.FromSelector = &oapi.Selector{}
		_ = rr.FromSelector.FromCelSelector(oapi.CelSelector{
			Cel: fmt.Sprintf("kind == '%s'", relType.fromKind),
		})

		// To selector - use CEL
		rr.ToSelector = &oapi.Selector{}
		_ = rr.ToSelector.FromCelSelector(oapi.CelSelector{
			Cel: fmt.Sprintf("kind == '%s'", relType.toKind),
		})

		// Matcher - use CEL expression for property matching
		matcher := &oapi.CelMatcher{
			Cel: "from.metadata.link_id == to.id",
		}
		_ = rr.Matcher.FromCelMatcher(*matcher)

		engine.PushEvent(ctx, handler.RelationshipRuleCreate, rr)
	}

	// Phase 6: Create resources
	b.Logf("Creating %d resources...", benchResourceCount)
	resourceIDs := make([]string, benchResourceCount)
	kinds := []string{
		"application", "database", "cache", "service", "vpc",
		"cluster", "region", "deployment", "config", "server",
	}
	tiers := []string{"frontend", "backend", "database", "middleware", "storage"}
	regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1"}

	for i := range benchResourceCount {
		if i%10 == 0 {
			log.Info("Creating resources...", "progress", i/10)
		}
		resourceID := uuid.New().String()
		resourceIDs[i] = resourceID

		resource := c.NewResource(workspaceID)
		resource.Id = resourceID
		resource.Name = fmt.Sprintf("resource-%d", i)
		resource.Kind = kinds[i%len(kinds)]
		resource.Metadata = map[string]string{
			"tier":    tiers[i%len(tiers)],
			"region":  regions[i%len(regions)],
			"index":   fmt.Sprintf("%d", i),
			"link_id": resourceIDs[i/2%len(resourceIDs)], // Create some relationships
		}
		resource.Config = map[string]interface{}{
			"replicas": i%10 + 1,
			"version":  fmt.Sprintf("v1.%d.0", i%100),
		}

		engine.PushEvent(ctx, handler.ResourceCreate, resource)

		// Add resource variables to some resources (references and literals)
		if i%50 == 0 && i > 0 {
			// Add 5 resource variables
			for rvIdx := 0; rvIdx < 5; rvIdx++ {
				key := fmt.Sprintf("resource_var_%d", rvIdx)

				// Mix of literal and reference values
				if rvIdx%2 == 0 {
					// Literal value
					resVar := &oapi.ResourceVariable{
						ResourceId: resourceID,
						Key:        key,
					}
					value := &oapi.Value{}
					literalValue := &oapi.LiteralValue{}
					_ = literalValue.FromStringValue(fmt.Sprintf("resource-value-%d-%d", i, rvIdx))
					_ = value.FromLiteralValue(*literalValue)
					resVar.Value = *value

					engine.PushEvent(ctx, handler.ResourceVariableCreate, resVar)
				} else {
					// Reference value to related resource
					if i > 100 {
						resVar := &oapi.ResourceVariable{
							ResourceId: resourceID,
							Key:        key,
						}
						value := &oapi.Value{}
						refValue := &oapi.ReferenceValue{
							Reference: relationshipTypes[rvIdx%len(relationshipTypes)].reference,
							Path:      []string{"metadata", "region"},
						}
						_ = value.FromReferenceValue(*refValue)
						resVar.Value = *value

						engine.PushEvent(ctx, handler.ResourceVariableCreate, resVar)
					}
				}
			}
		}
	}

	// Phase 7: Create deployment versions
	b.Logf("Creating %d versions per deployment (%d total)...", benchVersionsPerDeploy, benchDeploymentCount*benchVersionsPerDeploy)
	versionIDs := make([][]string, benchDeploymentCount)
	for i, deploymentID := range deploymentIDs {
		versionIDs[i] = make([]string, benchVersionsPerDeploy)
		for v := 0; v < benchVersionsPerDeploy; v++ {
			versionID := uuid.New().String()
			versionIDs[i][v] = versionID

			version := c.NewDeploymentVersion()
			version.Id = versionID
			version.DeploymentId = deploymentID
			version.Tag = fmt.Sprintf("v%d.%d.0", i, v)
			version.Name = fmt.Sprintf("version-%d-%d", i, v)

			// Most versions are ready, some are building/failed for realism
			if v%10 == 0 && v > 0 {
				version.Status = oapi.DeploymentVersionStatusBuilding
			} else if v%15 == 0 && v > 0 {
				version.Status = oapi.DeploymentVersionStatusFailed
			} else {
				version.Status = oapi.DeploymentVersionStatusReady
			}

			version.Config = map[string]any{
				"build_number": v,
				"commit_sha":   fmt.Sprintf("sha-%d-%d", i, v),
			}
			version.CreatedAt = time.Now().Add(-time.Duration(50-v) * time.Hour)

			engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)
		}
	}

	// Give the engine time to process all events and create jobs
	b.Log("Waiting for initial processing...")
	time.Sleep(2 * time.Second)

	// Phase 8: Complete jobs
	b.Logf("Processing jobs to create ~%d completed jobs...", benchTargetJobCount)
	jobsToCreate := benchTargetJobCount
	jobsCreated := 0
	processRounds := 0

	for jobsCreated < jobsToCreate && processRounds < benchMaxProcessRounds {
		processRounds++

		// Get pending jobs
		pendingJobs := engine.Workspace().Jobs().GetPending()

		if len(pendingJobs) == 0 {
			// Trigger more jobs by creating new versions or redeploying
			if processRounds%10 == 0 {
				// Create a few more versions to generate more jobs
				for i := 0; i < 5 && i < len(deploymentIDs); i++ {
					deploymentID := deploymentIDs[i%len(deploymentIDs)]
					versionID := uuid.New().String()
					version := c.NewDeploymentVersion()
					version.Id = versionID
					version.DeploymentId = deploymentID
					version.Tag = fmt.Sprintf("v%d.%d.%d", i, 50+processRounds, processRounds)
					version.Status = oapi.DeploymentVersionStatusReady
					version.CreatedAt = time.Now()
					engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)
				}
				time.Sleep(200 * time.Millisecond)
				continue
			}
			break
		}

		jobsToProcess := min(len(pendingJobs), benchJobBatchSize)

		jobIdx := 0
		for _, job := range pendingJobs {
			if jobIdx >= jobsToProcess {
				break
			}
			jobIdx++

			// 70% success, 30% failure
			now := time.Now()
			if jobsCreated%10 < 7 {
				job.Status = oapi.JobStatusSuccessful
			} else {
				job.Status = oapi.JobStatusFailure
			}
			job.CompletedAt = &now
			job.UpdatedAt = now

			engine.PushEvent(ctx, handler.JobUpdate, job)
			jobsCreated++
		}

		if jobIdx > 0 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	b.Logf("Created %d jobs (target: %d)", jobsCreated, jobsToCreate)

	// Get final statistics
	allJobs := engine.Workspace().Jobs().Items()
	resources := engine.Workspace().Resources().Items()
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	deployments := engine.Workspace().Deployments().Items()
	environments := engine.Workspace().Environments().Items()
	releases := engine.Workspace().Releases().Items()

	successCount := 0
	failCount := 0
	for _, job := range allJobs {
		switch job.Status {
		case oapi.JobStatusSuccessful:
			successCount++
		case oapi.JobStatusFailure:
			failCount++
		}
	}

	b.Logf("=== Benchmark Environment Statistics ===")
	b.Logf("Resources: %d", len(resources))
	b.Logf("Deployments: %d", len(deployments))
	b.Logf("Environments: %d", len(environments))
	b.Logf("Release Targets: %d", len(releaseTargets))
	b.Logf("Releases: %d", len(releases))
	b.Logf("Total Jobs: %d (Success: %d, Failed: %d)", len(allJobs), successCount, failCount)
	b.Logf("========================================")

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		rawEvent := handler.RawEvent{
			EventType:   handler.WorkspaceTick,
			WorkspaceID: workspaceID,
			Data:        []byte(fmt.Sprintf(`{"timestamp": %d}`, time.Now().Unix())),
		}

		err := tick.HandleWorkspaceTick(ctx, engine.Workspace(), rawEvent)
		if err != nil {
			b.Fatalf("HandleWorkspaceTick failed: %v", err)
		}
	}

	b.StopTimer()
	b.Logf("Benchmark completed successfully")
}

// BenchmarkEngine_LargeScale_Reconcile benchmarks the full reconciliation process after tick
func BenchmarkEngine_LargeScale_Reconcile(b *testing.B) {
	b.Log("Setting up large-scale reconciliation benchmark...")

	engine := integration.NewTestWorkspace(nil)
	ctx := context.Background()
	workspaceID := engine.Workspace().ID

	// Simplified setup - focus on reconciliation performance
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(workspaceID)
	jobAgent.Id = jobAgentID
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create 3 environments
	envIDs := make([]string, 3)
	for i := 0; i < 3; i++ {
		envID := uuid.New().String()
		envIDs[i] = envID
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = fmt.Sprintf("env-%d", i)
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		engine.PushEnvironmentCreateWithLink(ctx, sysID, env)
	}

	// Create 10 deployments
	depIDs := make([]string, 10)
	for i := 0; i < 10; i++ {
		depID := uuid.New().String()
		depIDs[i] = depID
		dep := c.NewDeployment(sysID)
		dep.Id = depID
		dep.JobAgentId = &jobAgentID
		dep.ResourceSelector = &oapi.Selector{}
		_ = dep.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		engine.PushDeploymentCreateWithLink(ctx, sysID, dep)

		// Create version
		version := c.NewDeploymentVersion()
		version.DeploymentId = depID
		version.Tag = "v1.0.0"
		version.Status = oapi.DeploymentVersionStatusReady
		engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)
	}

	// Create 1000 resources
	for i := 0; i < 1000; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	time.Sleep(500 * time.Millisecond)

	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	b.Logf("Created %d release targets for reconciliation", len(releaseTargets))

	// Benchmark the tick + reconciliation flow
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Trigger tick
		rawEvent := handler.RawEvent{
			EventType:   handler.WorkspaceTick,
			WorkspaceID: workspaceID,
			Data:        []byte(`{}`),
		}

		err := tick.HandleWorkspaceTick(ctx, engine.Workspace(), rawEvent)
		if err != nil {
			b.Fatalf("HandleWorkspaceTick failed: %v", err)
		}

		// Note: The actual reconciliation would happen via ProcessChanges in the event loop
		// For the benchmark, we're measuring the tick processing time itself
	}
}

func BenchmarkResourceInsertion_10(b *testing.B) {
	benchmarkResourceInsertion(b, 10)
}

// BenchmarkResourceInsertion_100 benchmarks inserting 100 resources
func BenchmarkResourceInsertion_100(b *testing.B) {
	benchmarkResourceInsertion(b, 100)
}

// BenchmarkResourceInsertion_1000 benchmarks inserting 1000 resources
func BenchmarkResourceInsertion_1000(b *testing.B) {
	benchmarkResourceInsertion(b, 1000)
}

// BenchmarkResourceInsertion_5000 benchmarks inserting 5000 resources
func BenchmarkResourceInsertion_5000(b *testing.B) {
	benchmarkResourceInsertion(b, 5000)
}

// BenchmarkResourceInsertion_15000 benchmarks inserting 15000 resources
func BenchmarkResourceInsertion_15000(b *testing.B) {
	benchmarkResourceInsertion(b, 15000)
}

// benchmarkResourceInsertion is a helper function that benchmarks resource insertion
func benchmarkResourceInsertion(b *testing.B, numResources int) {
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StopTimer()

		// Setup: Create test workspace
		ctx := context.Background()
		engine := integration.NewTestWorkspace(nil)
		workspaceID := engine.Workspace().ID

		// Setup: Create job agent
		jobAgentID := uuid.New().String()
		jobAgent := c.NewJobAgent(workspaceID)
		jobAgent.Id = jobAgentID
		jobAgent.Name = "Benchmark Job Agent"
		engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

		// Setup: Create system
		sysID := uuid.New().String()
		sys := c.NewSystem(workspaceID)
		sys.Id = sysID
		sys.Name = "bench-system"
		engine.PushEvent(ctx, handler.SystemCreate, sys)

		// Setup: Create 5 environments
		for envIdx := 0; envIdx < 5; envIdx++ {
			envID := uuid.New().String()
			env := c.NewEnvironment(sysID)
			env.Id = envID
			env.Name = fmt.Sprintf("env-%d", envIdx)
			env.ResourceSelector = &oapi.Selector{}
			_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
			engine.PushEnvironmentCreateWithLink(ctx, sysID, env)
		}

		// Setup: Create 30 deployments
		for depIdx := 0; depIdx < 30; depIdx++ {
			deploymentID := uuid.New().String()
			deployment := c.NewDeployment(sysID)
			deployment.Id = deploymentID
			deployment.Name = fmt.Sprintf("deployment-%d", depIdx)
			deployment.JobAgentId = &jobAgentID
			deployment.ResourceSelector = &oapi.Selector{}
			_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
			deployment.JobAgentConfig = map[string]any{
				"namespace": fmt.Sprintf("ns-%d", depIdx),
				"cluster":   fmt.Sprintf("cluster-%d", depIdx%5),
			}
			engine.PushDeploymentCreateWithLink(ctx, sysID, deployment)
		}

		// Setup: Create 5 relationship rules
		relationshipTypes := []struct {
			fromKind  string
			toKind    string
			reference string
		}{
			{"application", "database", "database"},
			{"application", "cache", "cache"},
			{"service", "vpc", "vpc"},
			{"cluster", "region", "region"},
			{"deployment", "config", "config"},
		}

		for _, relType := range relationshipTypes {
			rrID := uuid.New().String()
			rr := c.NewRelationshipRule(workspaceID)
			rr.Id = rrID
			rr.Name = fmt.Sprintf("%s-to-%s", relType.fromKind, relType.toKind)
			rr.Reference = relType.reference
			rr.FromType = "resource"
			rr.ToType = "resource"

			// From selector - use CEL
			rr.FromSelector = &oapi.Selector{}
			_ = rr.FromSelector.FromCelSelector(oapi.CelSelector{
				Cel: fmt.Sprintf("kind == '%s'", relType.fromKind),
			})

			// To selector - use CEL
			rr.ToSelector = &oapi.Selector{}
			_ = rr.ToSelector.FromCelSelector(oapi.CelSelector{
				Cel: fmt.Sprintf("kind == '%s'", relType.toKind),
			})

			// Matcher - use CEL expression for property matching
			matcher := &oapi.CelMatcher{
				Cel: "from.metadata.link_id == to.id",
			}
			_ = rr.Matcher.FromCelMatcher(*matcher)

			engine.PushEvent(ctx, handler.RelationshipRuleCreate, rr)
		}

		// Pre-generate all resource data to exclude UUID and string generation from benchmark
		resourceData := make([]struct {
			id       string
			name     string
			kind     string
			metadata map[string]string
			config   map[string]interface{}
		}, numResources)

		kinds := []string{
			"application", "database", "cache", "service", "vpc",
			"cluster", "region", "deployment", "config", "server",
		}
		tiers := []string{"frontend", "backend", "database", "middleware", "storage"}
		regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1"}

		for j := 0; j < numResources; j++ {
			resourceData[j].id = uuid.New().String()
			resourceData[j].name = fmt.Sprintf("resource-%d", j)
			resourceData[j].kind = kinds[j%len(kinds)]
			resourceData[j].metadata = map[string]string{
				"tier":   tiers[j%len(tiers)],
				"region": regions[j%len(regions)],
				"index":  fmt.Sprintf("%d", j),
			}
			resourceData[j].config = map[string]interface{}{
				"replicas": j%10 + 1,
				"version":  fmt.Sprintf("v1.%d.0", j%100),
			}
		}

		b.StartTimer()

		// Benchmark: Insert resources
		startTime := time.Now()
		for j := 0; j < numResources; j++ {
			data := resourceData[j]
			resource := c.NewResource(workspaceID)
			resource.Id = data.id
			resource.Name = data.name
			resource.Kind = data.kind
			resource.Metadata = data.metadata
			resource.Config = data.config

			engine.PushEvent(ctx, handler.ResourceCreate, resource)
		}
		elapsed := time.Since(startTime)

		b.StopTimer()

		// Report metrics
		resourcesPerSecond := float64(numResources) / elapsed.Seconds()
		b.ReportMetric(resourcesPerSecond, "resources/sec")
		b.ReportMetric(float64(elapsed.Microseconds())/float64(numResources), "μs/resource")
	}
}

// BenchmarkResourceInsertionParallel benchmarks parallel resource insertion
func BenchmarkResourceInsertionParallel(b *testing.B) {
	numResources := 1000

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StopTimer()

		// Setup: Create test workspace
		ctx := context.Background()
		engine := integration.NewTestWorkspace(nil)
		workspaceID := engine.Workspace().ID

		// Pre-generate all resource data
		resourceData := make([]struct {
			id       string
			name     string
			kind     string
			metadata map[string]string
			config   map[string]interface{}
		}, numResources)

		kinds := []string{
			"application", "database", "cache", "service", "vpc",
		}

		for j := 0; j < numResources; j++ {
			resourceData[j].id = uuid.New().String()
			resourceData[j].name = fmt.Sprintf("resource-%d", j)
			resourceData[j].kind = kinds[j%len(kinds)]
			resourceData[j].metadata = map[string]string{
				"index": fmt.Sprintf("%d", j),
			}
			resourceData[j].config = map[string]interface{}{
				"replicas": j%10 + 1,
			}
		}

		b.StartTimer()

		// Benchmark: Insert resources in parallel
		startTime := time.Now()
		b.RunParallel(func(pb *testing.PB) {
			idx := 0
			for pb.Next() {
				if idx >= numResources {
					break
				}
				data := resourceData[idx]
				resource := c.NewResource(workspaceID)
				resource.Id = data.id
				resource.Name = data.name
				resource.Kind = data.kind
				resource.Metadata = data.metadata
				resource.Config = data.config

				engine.PushEvent(ctx, handler.ResourceCreate, resource)
				idx++
			}
		})
		elapsed := time.Since(startTime)

		b.StopTimer()

		// Report metrics
		resourcesPerSecond := float64(numResources) / elapsed.Seconds()
		b.ReportMetric(resourcesPerSecond, "resources/sec")
		b.ReportMetric(float64(elapsed.Microseconds())/float64(numResources), "μs/resource")
	}
}
