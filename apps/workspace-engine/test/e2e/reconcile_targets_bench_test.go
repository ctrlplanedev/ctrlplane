package e2e

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// BenchmarkReconcileTargets_DeploymentVersionCreated benchmarks the ReconcileTargets method
// when a new deployment version is created, simulating production conditions.
//
// This replicates the scenario where creating a new deployment version can take up to 20s in production.
//
// Run with:
//
//	go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated -benchmem -benchtime=10x ./test/e2e/
func BenchmarkReconcileTargets_DeploymentVersionCreated(b *testing.B) {
	// Benchmark configuration - adjust these to match production scale
	const (
		numDeployments    = 50
		numResources      = 100
		numEnvironments   = 20
		numRegions        = 5
		numZones          = 10
		numPolicies       = 2
		numRelationships  = 2
		resourceBatchSize = 1000
	)

	b.Logf("Setting up production-scale benchmark environment...")
	b.Logf("Configuration: %d deployments, %d resources, %d environments, %d policies, %d relationships",
		numDeployments, numResources, numEnvironments, numPolicies, numRelationships)

	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Phase 1: Create job agent
	b.Log("Phase 1: Creating job agent...")
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(workspaceID)
	jobAgent.Id = jobAgentID
	jobAgent.Name = "Benchmark Job Agent"
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Phase 2: Create system
	b.Log("Phase 2: Creating system...")
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	sys.Name = "prod-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Phase 3: Create environments
	b.Logf("Phase 3: Creating %d environments...", numEnvironments)
	environmentIDs := make([]string, numEnvironments)
	for i := 0; i < numEnvironments; i++ {
		envID := uuid.New().String()
		environmentIDs[i] = envID
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = fmt.Sprintf("env-%d", i)

		// Each environment selects resources based on region metadata
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{
			Cel: fmt.Sprintf("resource.metadata.region == 'region-%d'", i%numRegions),
		})
		engine.PushEvent(ctx, handler.EnvironmentCreate, env)
	}

	// Phase 4: Create resources distributed across regions
	b.Logf("Phase 4: Creating %d resources...", numResources)
	resourceIDs := make([]string, numResources)

	// Create resources in batches for better performance
	numBatches := numResources / resourceBatchSize
	for batch := 0; batch < numBatches; batch++ {
		for i := 0; i < resourceBatchSize; i++ {
			idx := batch*resourceBatchSize + i
			resourceID := uuid.New().String()
			resourceIDs[idx] = resourceID

			resource := c.NewResource(workspaceID)
			resource.Id = resourceID
			resource.Name = fmt.Sprintf("resource-%d", idx)
			resource.Kind = "kubernetes-cluster"
			resource.Version = "v1.28.0"

			// Distribute resources across regions and zones
			resource.Metadata = map[string]string{
				"region":      fmt.Sprintf("region-%d", idx%numRegions),
				"zone":        fmt.Sprintf("zone-%d", idx%numZones),
				"environment": fmt.Sprintf("env-%d", idx%numEnvironments),
			}

			engine.PushEvent(ctx, handler.ResourceCreate, resource)
		}

		if (batch+1)%5 == 0 {
			b.Logf("  Created %d/%d resources...", (batch+1)*resourceBatchSize, numResources)
		}
	}

	// Phase 5: Create deployments
	b.Logf("Phase 5: Creating %d deployments...", numDeployments)
	deploymentIDs := make([]string, numDeployments)
	for i := range numDeployments {
		depID := uuid.New().String()
		deploymentIDs[i] = depID

		deployment := c.NewDeployment(sysID)
		deployment.Id = depID
		deployment.Name = fmt.Sprintf("deployment-%d", i)
		deployment.Slug = fmt.Sprintf("deployment-%d", i)
		deployment.JobAgentId = &jobAgentID

		// All deployments select all resources
		deployment.ResourceSelector = &oapi.Selector{}
		_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})

		engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

		if (i+1)%10 == 0 {
			b.Logf("  Created %d/%d deployments...", i+1, numDeployments)
		}
	}

	// Phase 6: Create policies
	b.Logf("Phase 6: Creating %d policies...", numPolicies)

	// Policy 1: Approval policy for production environments
	policy1 := c.NewPolicy(workspaceID)
	policy1.Name = "prod-approval-policy"
	policy1.Enabled = true

	policy1.Selector = `environment.name.startsWith("env-1")`
	policy1.Rules = []oapi.PolicyRule{
		{
			Id:       uuid.New().String(),
			PolicyId: policy1.Id,
			AnyApproval: &oapi.AnyApprovalRule{
				MinApprovals: 1,
			},
			CreatedAt: time.Now().Format(time.RFC3339),
		},
	}

	engine.PushEvent(ctx, handler.PolicyCreate, policy1)

	// Policy 2: Gradual rollout policy
	policy2 := c.NewPolicy(workspaceID)
	policy2.Name = "gradual-rollout-policy"
	policy2.Enabled = true

	policy2.Selector = "true"
	policy2.Rules = []oapi.PolicyRule{
		{
			Id:        uuid.New().String(),
			PolicyId:  policy2.Id,
			CreatedAt: time.Now().Format(time.RFC3339),
		},
	}

	engine.PushEvent(ctx, handler.PolicyCreate, policy2)

	// Phase 7: Create relationship rules
	b.Logf("Phase 7: Creating %d relationship rules...", numRelationships)

	// Relationship 1: Resources in the same region
	rel1 := &oapi.RelationshipRule{
		Id:          uuid.New().String(),
		Name:        "same-region-resources",
		Reference:   "peer",
		FromType:    "resource",
		ToType:      "resource",
		WorkspaceId: workspaceID,
	}

	rel1FromSelector := &oapi.Selector{}
	_ = rel1FromSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
	rel1.FromSelector = rel1FromSelector

	rel1ToSelector := &oapi.Selector{}
	_ = rel1ToSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
	rel1.ToSelector = rel1ToSelector

	_ = rel1.Matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.metadata.region == to.metadata.region && from.id != to.id",
	})

	engine.PushEvent(ctx, handler.RelationshipRuleCreate, rel1)

	// Relationship 2: Resources in the same zone
	rel2 := &oapi.RelationshipRule{
		Id:          uuid.New().String(),
		Name:        "same-zone-resources",
		Reference:   "adjacent",
		FromType:    "resource",
		ToType:      "resource",
		WorkspaceId: workspaceID,
	}

	rel2FromSelector := &oapi.Selector{}
	_ = rel2FromSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
	rel2.FromSelector = rel2FromSelector

	rel2ToSelector := &oapi.Selector{}
	_ = rel2ToSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
	rel2.ToSelector = rel2ToSelector

	_ = rel2.Matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.metadata.zone == to.metadata.zone && from.id != to.id",
	})

	engine.PushEvent(ctx, handler.RelationshipRuleCreate, rel2)

	b.Log("Phase 8: Collecting workspace statistics...")

	// Get workspace stats
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	resources := engine.Workspace().Resources().Items()
	deployments := engine.Workspace().Deployments().Items()
	environments := engine.Workspace().Environments().Items()
	policies := engine.Workspace().Policies().Items()
	relationshipRules := engine.Workspace().RelationshipRules().Items()

	b.Logf("=== Benchmark Environment Statistics ===")
	b.Logf("Resources: %d", len(resources))
	b.Logf("Deployments: %d", len(deployments))
	b.Logf("Environments: %d", len(environments))
	b.Logf("Release Targets: %d", len(releaseTargets))
	b.Logf("Policies: %d", len(policies))
	b.Logf("Relationship Rules: %d", len(relationshipRules))
	b.Logf("========================================")

	// Phase 9: Run the benchmark - Simulate creating a new deployment version for the first deployment
	// This is the operation that takes 20s in production
	b.Log("Phase 9: Starting benchmark - simulating deployment version creation...")

	// Get the first deployment's release targets (this is what ReconcileTargets will be called with)
	firstDeploymentID := deploymentIDs[0]
	releaseTargetsForDeployment, err := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, firstDeploymentID)
	if err != nil {
		b.Fatalf("Failed to get release targets for deployment: %v", err)
	}

	b.Logf("Deployment has %d release targets to reconcile", len(releaseTargetsForDeployment))

	// Reset timer before the actual benchmark
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a new deployment version
		deploymentVersion := c.NewDeploymentVersion()
		deploymentVersion.DeploymentId = firstDeploymentID
		deploymentVersion.Tag = fmt.Sprintf("v1.0.%d", i)
		deploymentVersion.Config = map[string]any{
			"image": fmt.Sprintf("myapp:v1.0.%d", i),
		}

		// Upsert the deployment version
		engine.Workspace().DeploymentVersions().Upsert(ctx, deploymentVersion.Id, deploymentVersion)

		// This is the expensive operation - ReconcileTargets is called when a deployment version is created
		// In production, this is happening in deploymentversion.HandleDeploymentVersionCreated
		err := engine.Workspace().ReleaseManager().ReconcileTargets(ctx, releaseTargetsForDeployment,
			releasemanager.WithTrigger(trace.TriggerVersionCreated))

		if err != nil {
			b.Fatalf("ReconcileTargets failed: %v", err)
		}
	}

	b.StopTimer()
	b.Logf("Benchmark completed successfully")
}

// BenchmarkReconcileTargets_SingleDeployment benchmarks ReconcileTargets with a single deployment
// to establish a baseline for comparison with the large-scale benchmark.
//
// Run with:
//
//	go test -bench=BenchmarkReconcileTargets_SingleDeployment -benchmem ./test/e2e/
func BenchmarkReconcileTargets_SingleDeployment(b *testing.B) {
	b.Log("Setting up single deployment benchmark...")

	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create job agent
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(workspaceID)
	jobAgent.Id = jobAgentID
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create 1 environment
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create 100 resources
	for i := 0; i < 100; i++ {
		resource := c.NewResource(workspaceID)
		resource.Id = uuid.New().String()
		resource.Name = fmt.Sprintf("resource-%d", i)
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	// Create 1 deployment
	depID := uuid.New().String()
	deployment := c.NewDeployment(sysID)
	deployment.Id = depID
	deployment.JobAgentId = &jobAgentID
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Get release targets
	releaseTargetsForDeployment, _ := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, depID)
	b.Logf("Single deployment has %d release targets", len(releaseTargetsForDeployment))

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		deploymentVersion := c.NewDeploymentVersion()
		deploymentVersion.DeploymentId = depID
		deploymentVersion.Tag = fmt.Sprintf("v1.0.%d", i)

		engine.Workspace().DeploymentVersions().Upsert(ctx, deploymentVersion.Id, deploymentVersion)

		err := engine.Workspace().ReleaseManager().ReconcileTargets(ctx, releaseTargetsForDeployment,
			releasemanager.WithTrigger(trace.TriggerVersionCreated))

		if err != nil {
			b.Fatalf("ReconcileTargets failed: %v", err)
		}
	}

	b.StopTimer()
}

// BenchmarkReconcileTargets_Scaling benchmarks ReconcileTargets with varying numbers of targets
// to understand the scaling characteristics.
//
// Run with:
//
//	go test -bench=BenchmarkReconcileTargets_Scaling -benchmem ./test/e2e/
func BenchmarkReconcileTargets_Scaling(b *testing.B) {
	targetCounts := []int{100, 500, 1000, 5000, 10000}

	for _, targetCount := range targetCounts {
		b.Run(fmt.Sprintf("targets_%d", targetCount), func(b *testing.B) {
			ctx := context.Background()
			engine := integration.NewTestWorkspace(nil)
			workspaceID := engine.Workspace().ID

			// Setup
			jobAgentID := uuid.New().String()
			jobAgent := c.NewJobAgent(workspaceID)
			jobAgent.Id = jobAgentID
			engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

			sysID := uuid.New().String()
			sys := c.NewSystem(workspaceID)
			sys.Id = sysID
			engine.PushEvent(ctx, handler.SystemCreate, sys)

			envID := uuid.New().String()
			env := c.NewEnvironment(sysID)
			env.Id = envID
			env.ResourceSelector = &oapi.Selector{}
			_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
			engine.PushEvent(ctx, handler.EnvironmentCreate, env)

			// Create resources
			for i := 0; i < targetCount; i++ {
				resource := c.NewResource(workspaceID)
				resource.Id = uuid.New().String()
				resource.Name = fmt.Sprintf("resource-%d", i)
				engine.PushEvent(ctx, handler.ResourceCreate, resource)
			}

			depID := uuid.New().String()
			deployment := c.NewDeployment(sysID)
			deployment.Id = depID
			deployment.JobAgentId = &jobAgentID
			deployment.ResourceSelector = &oapi.Selector{}
			_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
			engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

			releaseTargetsForDeployment, _ := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, depID)

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				deploymentVersion := c.NewDeploymentVersion()
				deploymentVersion.DeploymentId = depID
				deploymentVersion.Tag = fmt.Sprintf("v1.0.%d", i)

				engine.Workspace().DeploymentVersions().Upsert(ctx, deploymentVersion.Id, deploymentVersion)

				err := engine.Workspace().ReleaseManager().ReconcileTargets(ctx, releaseTargetsForDeployment,
					releasemanager.WithTrigger(trace.TriggerVersionCreated))

				if err != nil {
					b.Fatalf("ReconcileTargets failed: %v", err)
				}
			}

			b.StopTimer()
		})
	}
}
