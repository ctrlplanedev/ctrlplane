package e2e

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/test/integration"
	"workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

func TestEngine_DeploymentVersionCreation(t *testing.T) {
	dv1Id := "dv1"
	dv2Id := "dv2"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(integration.DeploymentVersionID(dv1Id)),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(dv2Id)),
			),
		),
	)

	engineDv1, _ := engine.Workspace().DeploymentVersions().Get(dv1Id)
	engineDv2, _ := engine.Workspace().DeploymentVersions().Get(dv2Id)

	if engineDv1.Id != dv1Id {
		t.Fatalf("deployment versions have the same id")
	}

	if engineDv2.Id != dv2Id {
		t.Fatalf("deployment versions have the same id")
	}
}

// TestEngine_DeploymentVersionCreatesJobsForAllReleaseTargets verifies that when a deployment version
// is created, jobs are created for ALL matching release targets
func TestEngine_DeploymentVersionCreatesJobsForAllReleaseTargets(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(integration.EnvironmentName("staging")),
			integration.WithEnvironment(integration.EnvironmentName("production")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
		integration.WithResource(integration.ResourceName("server-3")),
	)

	ctx := context.Background()

	// Verify release targets: 1 deployment * 2 environments * 3 resources = 6 release targets
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 6 {
		t.Fatalf("expected 6 release targets, got %d", len(releaseTargets))
	}

	// Initially no jobs
	initialJobs := engine.Workspace().Jobs().GetPending()
	if len(initialJobs) != 0 {
		t.Fatalf("expected 0 jobs before deployment version, got %d", len(initialJobs))
	}

	// Create a deployment version
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify jobs were created for ALL release targets
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 6 {
		t.Fatalf("expected 6 jobs after deployment version creation, got %d", len(pendingJobs))
	}

	// Verify all jobs have correct properties
	for _, job := range pendingJobs {
		if job.DeploymentId != deploymentId {
			t.Errorf("job %s has incorrect deployment_id: expected %s, got %s", job.Id, deploymentId, job.DeploymentId)
		}
		if job.JobAgentId != jobAgentId {
			t.Errorf("job %s has incorrect job_agent_id: expected %s, got %s", job.Id, jobAgentId, job.JobAgentId)
		}
		if job.Status != pb.JobStatus_JOB_STATUS_PENDING {
			t.Errorf("job %s has incorrect status: expected PENDING, got %v", job.Id, job.Status)
		}
	}
}

// TestEngine_SequentialDeploymentVersionsCreateCorrectJobs verifies that adding multiple
// deployment versions in sequence creates the correct jobs
func TestEngine_SequentialDeploymentVersionsCreateCorrectJobs(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(integration.EnvironmentName("production")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
	)

	ctx := context.Background()

	// Create multiple deployment versions sequentially
	versions := []string{"v1.0.0", "v1.1.0", "v1.2.0", "v2.0.0"}

	for i, versionTag := range versions {
		// Create deployment version
		dv := creators.NewDeploymentVersion()
		dv.DeploymentId = deploymentId
		dv.Tag = versionTag
		engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

		// Each deployment version should create 2 jobs (1 env * 2 resources)
		// Total jobs accumulate or get replaced depending on implementation
		allJobs := engine.Workspace().Jobs().Items()
		t.Logf("After version %s: %d total jobs", versionTag, len(allJobs))

		// Verify at least some jobs exist for this deployment
		jobsForDeployment := 0
		for _, job := range allJobs {
			if job.DeploymentId == deploymentId {
				jobsForDeployment++
			}
		}

		if jobsForDeployment < 2 {
			t.Errorf("after creating version %d (%s), expected at least 2 jobs for deployment, got %d",
				i+1, versionTag, jobsForDeployment)
		}
	}

	// Verify final state
	allJobs := engine.Workspace().Jobs().Items()
	t.Logf("Final total jobs: %d", len(allJobs))

	// Count jobs per version
	jobsByVersion := make(map[string]int)
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.Version != nil {
			jobsByVersion[release.Version.Tag]++
		}
	}

	t.Logf("Jobs per version: %v", jobsByVersion)
}

// TestEngine_DeploymentVersionJobCreationWithConfig verifies that deployment versions
// with config are properly propagated to created jobs via releases
func TestEngine_DeploymentVersionJobCreationWithConfig(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(integration.EnvironmentName("prod")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()

	// Create deployment version with config
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	dv.Config = creators.MustNewStructFromMap(map[string]any{
		"image":      "myapp:v1.0.0",
		"git_commit": "abc123",
		"replicas":   3,
	})
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(pendingJobs))
	}

	// Verify job references the correct release with config
	var job *pb.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found for job", job.ReleaseId)
	}

	if release.Version == nil {
		t.Fatal("expected release version to be set")
	}

	if release.Version.Tag != "v1.0.0" {
		t.Errorf("expected release tag v1.0.0, got %s", release.Version.Tag)
	}

	// Verify config is preserved on the version
	if release.Version.Config == nil {
		t.Fatal("expected version config to be set")
	}

	config := release.Version.Config.AsMap()
	if config["image"] != "myapp:v1.0.0" {
		t.Errorf("expected image=myapp:v1.0.0, got %v", config["image"])
	}
	if config["git_commit"] != "abc123" {
		t.Errorf("expected git_commit=abc123, got %v", config["git_commit"])
	}
	if config["replicas"] != float64(3) {
		t.Errorf("expected replicas=3, got %v", config["replicas"])
	}
}

// TestEngine_MultipleDeploymentsIndependentVersions verifies that deployment versions
// for different deployments create independent jobs
func TestEngine_MultipleDeploymentsIndependentVersions(t *testing.T) {
	jobAgentId := uuid.New().String()
	deployment1Id := uuid.New().String()
	deployment2Id := uuid.New().String()
	systemId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentID(deployment1Id),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2Id),
				integration.DeploymentName("worker-service"),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(integration.EnvironmentName("production")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
	)

	ctx := context.Background()

	// Verify release targets: 2 deployments * 1 environment * 2 resources = 4
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets, got %d", len(releaseTargets))
	}

	// Create deployment version for first deployment
	dv1 := creators.NewDeploymentVersion()
	dv1.DeploymentId = deployment1Id
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Should create 2 jobs (1 env * 2 resources)
	jobsAfterFirst := engine.Workspace().Jobs().GetPending()
	if len(jobsAfterFirst) != 2 {
		t.Fatalf("expected 2 jobs after first deployment version, got %d", len(jobsAfterFirst))
	}

	// Verify all jobs are for deployment1
	for _, job := range jobsAfterFirst {
		if job.DeploymentId != deployment1Id {
			t.Errorf("expected job for deployment1 %s, got %s", deployment1Id, job.DeploymentId)
		}
	}

	// Create deployment version for second deployment
	dv2 := creators.NewDeploymentVersion()
	dv2.DeploymentId = deployment2Id
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Should now have 4 jobs total
	jobsAfterSecond := engine.Workspace().Jobs().GetPending()
	if len(jobsAfterSecond) != 4 {
		t.Fatalf("expected 4 jobs after both deployment versions, got %d", len(jobsAfterSecond))
	}

	// Count jobs per deployment
	deployment1Jobs := 0
	deployment2Jobs := 0
	for _, job := range jobsAfterSecond {
		if job.DeploymentId == deployment1Id {
			deployment1Jobs++
		} else if job.DeploymentId == deployment2Id {
			deployment2Jobs++
		}
	}

	if deployment1Jobs != 2 {
		t.Errorf("expected 2 jobs for deployment1, got %d", deployment1Jobs)
	}
	if deployment2Jobs != 2 {
		t.Errorf("expected 2 jobs for deployment2, got %d", deployment2Jobs)
	}
}

// TestEngine_DeploymentVersionWithNoJobAgent verifies that deployment versions
// for deployments without job agents don't create jobs
func TestEngine_DeploymentVersionWithNoJobAgent(t *testing.T) {
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("manual-deployment"),
				// No job agent specified
			),
			integration.WithEnvironment(integration.EnvironmentName("production")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()

	// Create deployment version
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify NO jobs were created (no job agent)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 jobs without job agent, got %d", len(pendingJobs))
	}
}

// TestEngine_DeploymentVersionWithFilteredReleaseTargets verifies that deployment versions
// only create jobs for release targets that match the deployment's resource filter
func TestEngine_DeploymentVersionWithFilteredReleaseTargets(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "tier",
					"value":    "production",
				}),
			),
			integration.WithEnvironment(integration.EnvironmentName("prod")),
		),
		integration.WithResource(
			integration.ResourceName("prod-server-1"),
			integration.ResourceMetadata(map[string]string{"tier": "production"}),
		),
		integration.WithResource(
			integration.ResourceName("prod-server-2"),
			integration.ResourceMetadata(map[string]string{"tier": "production"}),
		),
		integration.WithResource(
			integration.ResourceName("dev-server-1"),
			integration.ResourceMetadata(map[string]string{"tier": "development"}),
		),
	)

	ctx := context.Background()

	// Verify only 2 release targets (matching production tier)
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets (filtered), got %d", len(releaseTargets))
	}

	// Create deployment version
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify only 2 jobs created (only for production resources)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 jobs (filtered by resource selector), got %d", len(pendingJobs))
	}

	// Verify jobs are only for production resources
	for _, job := range pendingJobs {
		resource, ok := engine.Workspace().Resources().Get(job.ResourceId)
		if !ok {
			t.Fatalf("resource %s not found", job.ResourceId)
		}
		if resource.Metadata["tier"] != "production" {
			t.Errorf("expected job for production resource, got resource with tier=%s", resource.Metadata["tier"])
		}
	}
}

// TestEngine_DeploymentVersionCreationWithMultipleEnvironments verifies correct job creation
// across multiple environments with different resource selectors
func TestEngine_DeploymentVersionCreationWithMultipleEnvironments(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	envDevId := uuid.New().String()
	envProdId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envDevId),
				integration.EnvironmentName("development"),
				integration.EnvironmentResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "env",
					"value":    "dev",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envProdId),
				integration.EnvironmentName("production"),
				integration.EnvironmentResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "env",
					"value":    "prod",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceName("dev-server-1"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceName("dev-server-2"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceName("prod-server-1"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceName("prod-server-2"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceName("prod-server-3"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)

	ctx := context.Background()

	// Verify release targets: 1 deployment * (1 dev env * 2 dev resources + 1 prod env * 3 prod resources) = 5
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 5 {
		t.Fatalf("expected 5 release targets, got %d", len(releaseTargets))
	}

	// Create deployment version
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify 5 jobs created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 5 {
		t.Fatalf("expected 5 jobs, got %d", len(pendingJobs))
	}

	// Count jobs per environment
	devJobs := 0
	prodJobs := 0
	for _, job := range pendingJobs {
		if job.EnvironmentId == envDevId {
			devJobs++
		} else if job.EnvironmentId == envProdId {
			prodJobs++
		}
	}

	if devJobs != 2 {
		t.Errorf("expected 2 jobs for dev environment, got %d", devJobs)
	}
	if prodJobs != 3 {
		t.Errorf("expected 3 jobs for prod environment, got %d", prodJobs)
	}
}

// TestEngine_DeploymentVersionJobsWithJobAgentConfig verifies that job agent config
// is properly propagated from deployment to created jobs
func TestEngine_DeploymentVersionJobsWithJobAgentConfig(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

	jobAgentConfig := map[string]any{
		"timeout":       300,
		"retries":       3,
		"deploy_script": "/scripts/deploy.sh",
	}

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentJobAgentConfig(jobAgentConfig),
			),
			integration.WithEnvironment(integration.EnvironmentName("prod")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()

	// Create deployment version
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job has correct config
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(pendingJobs))
	}

	var job *pb.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	if job.JobAgentConfig == nil {
		t.Fatal("job agent config is nil")
	}

	config := job.JobAgentConfig.AsMap()
	if config["timeout"] != float64(300) {
		t.Errorf("expected timeout=300, got %v", config["timeout"])
	}
	if config["retries"] != float64(3) {
		t.Errorf("expected retries=3, got %v", config["retries"])
	}
	if config["deploy_script"] != "/scripts/deploy.sh" {
		t.Errorf("expected deploy_script=/scripts/deploy.sh, got %v", config["deploy_script"])
	}
}

// TestEngine_ConcurrentDeploymentVersionCreation tests creating multiple deployment versions
// rapidly to ensure job creation is handled correctly
func TestEngine_ConcurrentDeploymentVersionCreation(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(integration.EnvironmentName("prod")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
	)

	ctx := context.Background()

	// Create multiple deployment versions rapidly
	numVersions := 10
	for i := 0; i < numVersions; i++ {
		dv := creators.NewDeploymentVersion()
		dv.DeploymentId = deploymentId
		dv.Tag = fmt.Sprintf("v1.%d.0", i)
		engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)
	}

	// Verify all versions were created
	allVersions := engine.Workspace().DeploymentVersions().Items()
	versionCount := 0
	for _, dv := range allVersions {
		if dv.DeploymentId == deploymentId {
			versionCount++
		}
	}

	if versionCount != numVersions {
		t.Errorf("expected %d deployment versions, got %d", numVersions, versionCount)
	}

	// Verify jobs exist (exact count depends on job replacement strategy)
	allJobs := engine.Workspace().Jobs().Items()
	jobCount := 0
	for _, job := range allJobs {
		if job.DeploymentId == deploymentId {
			jobCount++
		}
	}

	t.Logf("Created %d deployment versions, resulting in %d jobs", numVersions, jobCount)

	// At minimum, we should have jobs for the latest version (2 resources)
	if jobCount < 2 {
		t.Errorf("expected at least 2 jobs, got %d", jobCount)
	}
}

func BenchmarkEngine_DeploymentVersionCreation(b *testing.B) {
	engine := integration.NewTestWorkspace(nil)

	const numVersions = 1

	versions := make([]*pb.DeploymentVersion, numVersions)
	for i := range versions {
		versions[i] = creators.NewDeploymentVersion()
	}

	ctx := context.Background()

	b.ResetTimer()
	for b.Loop() {
		for _, dv := range versions {
			engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)
		}
	}
}
