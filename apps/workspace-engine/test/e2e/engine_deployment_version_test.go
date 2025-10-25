package e2e

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
		integration.WithResource(integration.ResourceName("server-3")),
	)

	ctx := context.Background()

	// Verify release targets: 1 deployment * 2 environments * 3 resources = 6 release targets
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
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
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Errorf("release %s not found for job %s", job.ReleaseId, job.Id)
			continue
		}
		if release.ReleaseTarget.DeploymentId != deploymentId {
			t.Errorf("job %s has incorrect deployment_id: expected %s, got %s", job.Id, deploymentId, release.ReleaseTarget.DeploymentId)
		}
		if job.JobAgentId != jobAgentId {
			t.Errorf("job %s has incorrect job_agent_id: expected %s, got %s", job.Id, jobAgentId, job.JobAgentId)
		}
		if job.Status != oapi.Pending {
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
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
			release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
			if ok && release.ReleaseTarget.DeploymentId == deploymentId {
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
		if ok {
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()

	// Create deployment version with config
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	dv.Config = map[string]any{
		"image":      "myapp:v1.0.0",
		"git_commit": "abc123",
		"replicas":   3,
	}
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(pendingJobs))
	}

	// Verify job references the correct release with config
	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found for job", job.ReleaseId)
	}

	if release.Version.Tag != "v1.0.0" {
		t.Errorf("expected release tag v1.0.0, got %s", release.Version.Tag)
	}

	// Verify config is preserved on the version
	if release.Version.Config == nil {
		t.Fatal("expected version config to be set")
	}

	config := release.Version.Config
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2Id),
				integration.DeploymentName("worker-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
	)

	ctx := context.Background()

	// Verify release targets: 2 deployments * 1 environment * 2 resources = 4
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
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
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Errorf("release %s not found for job %s", job.ReleaseId, job.Id)
			continue
		}
		if release.ReleaseTarget.DeploymentId != deployment1Id {
			t.Errorf("expected job for deployment1 %s, got %s", deployment1Id, release.ReleaseTarget.DeploymentId)
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
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		switch release.ReleaseTarget.DeploymentId {
		case deployment1Id:
			deployment1Jobs++
		case deployment2Id:
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
// for deployments without job agents create jobs with InvalidJobAgent status
func TestEngine_DeploymentVersionWithNoJobAgent(t *testing.T) {
	deploymentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("manual-deployment"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent specified
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()

	// Create deployment version
	dv := creators.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job without job agent, got %d", len(allJobs))
	}

	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}

	if job.Status != oapi.InvalidJobAgent {
		t.Errorf("expected job status InvalidJobAgent, got %v", job.Status)
	}

	if job.JobAgentId != "" {
		t.Errorf("expected empty job agent ID, got %s", job.JobAgentId)
	}

	// Verify no pending jobs (InvalidJobAgent jobs are not pending)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Errorf("expected 0 pending jobs, got %d", len(pendingJobs))
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
				integration.DeploymentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "tier",
					"value":    "production",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
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
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
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
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found", job.ReleaseId)
		}
		resource, ok := engine.Workspace().Resources().Get(release.ReleaseTarget.ResourceId)
		if !ok {
			t.Fatalf("resource %s not found", release.ReleaseTarget.ResourceId)
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envDevId),
				integration.EnvironmentName("development"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "env",
					"value":    "dev",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envProdId),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
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
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
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
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		switch release.ReleaseTarget.EnvironmentId {
		case envDevId:
			devJobs++
		case envProdId:
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
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgentConfig(jobAgentConfig),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
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

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	if job.JobAgentConfig == nil {
		t.Fatal("job agent config is nil")
	}

	config := job.JobAgentConfig
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
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
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.ReleaseTarget.DeploymentId == deploymentId {
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

	versions := make([]*oapi.DeploymentVersion, numVersions)
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

// TestEngine_LatestWins verifies that when a newer version is released,
// older pending jobs for the same release target are automatically cancelled
func TestEngine_LatestWins(t *testing.T) {
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()

	// Verify we have 1 release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Create v1.0.0
	dv1 := creators.NewDeploymentVersion()
	dv1.DeploymentId = deploymentId
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Verify job was created for v1.0.0
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after v1.0.0, got %d", len(pendingJobs))
	}

	var v1Job *oapi.Job
	for _, job := range pendingJobs {
		v1Job = job
		break
	}

	// Verify job is for v1.0.0
	v1Release, ok := engine.Workspace().Releases().Get(v1Job.ReleaseId)
	if !ok {
		t.Fatal("release not found for v1 job")
	}
	if v1Release.Version.Tag != "v1.0.0" {
		t.Fatalf("expected job for v1.0.0, got %s", v1Release.Version.Tag)
	}

	// Create v2.0.0 (newer version)
	dv2 := creators.NewDeploymentVersion()
	dv2.DeploymentId = deploymentId
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Verify:
	// 1. v1 job should be cancelled
	// 2. v2 job should be pending
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 total jobs, got %d", len(allJobs))
	}

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after v2.0.0 (v1 should be cancelled), got %d", len(pendingJobs))
	}

	// Verify the pending job is for v2.0.0
	var v2Job *oapi.Job
	for _, job := range pendingJobs {
		v2Job = job
		break
	}

	v2Release, ok := engine.Workspace().Releases().Get(v2Job.ReleaseId)
	if !ok {
		t.Fatal("release not found for v2 job")
	}
	if v2Release.Version.Tag != "v2.0.0" {
		t.Fatalf("expected pending job for v2.0.0, got %s", v2Release.Version.Tag)
	}

	// Verify v1 job was cancelled
	v1JobUpdated, ok := engine.Workspace().Jobs().Get(v1Job.Id)
	if !ok {
		t.Fatal("v1 job not found")
	}
	if v1JobUpdated.Status != oapi.Cancelled {
		t.Fatalf("expected v1 job to be cancelled, got status %v", v1JobUpdated.Status)
	}

	// Create v3.0.0 (even newer version)
	dv3 := creators.NewDeploymentVersion()
	dv3.DeploymentId = deploymentId
	dv3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv3)

	// Verify:
	// 1. Both v1 and v2 jobs should be cancelled
	// 2. Only v3 job should be pending
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 3 {
		t.Fatalf("expected 3 total jobs, got %d", len(allJobs))
	}

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after v3.0.0 (v1 and v2 should be cancelled), got %d", len(pendingJobs))
	}

	// Verify the pending job is for v3.0.0
	var v3Job *oapi.Job
	for _, job := range pendingJobs {
		v3Job = job
		break
	}

	v3Release, ok := engine.Workspace().Releases().Get(v3Job.ReleaseId)
	if !ok {
		t.Fatal("release not found for v3 job")
	}
	if v3Release.Version.Tag != "v3.0.0" {
		t.Fatalf("expected pending job for v3.0.0, got %s", v3Release.Version.Tag)
	}

	// Verify v2 job was also cancelled
	v2JobUpdated, ok := engine.Workspace().Jobs().Get(v2Job.Id)
	if !ok {
		t.Fatal("v2 job not found")
	}
	if v2JobUpdated.Status != oapi.Cancelled {
		t.Fatalf("expected v2 job to be cancelled, got status %v", v2JobUpdated.Status)
	}
}

// TestEngine_LatestWins_MultipleReleaseTargets verifies that latest wins
// only affects jobs for the same release target, not other release targets
func TestEngine_LatestWins_MultipleReleaseTargets(t *testing.T) {
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
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
	)

	ctx := context.Background()

	// Verify we have 2 release targets (1 deployment * 1 environment * 2 resources)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Create v1.0.0 - should create 2 jobs (one per release target)
	dv1 := creators.NewDeploymentVersion()
	dv1.DeploymentId = deploymentId
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs after v1.0.0, got %d", len(pendingJobs))
	}

	// Create v2.0.0 - should cancel both v1.0.0 jobs and create 2 new v2.0.0 jobs
	dv2 := creators.NewDeploymentVersion()
	dv2.DeploymentId = deploymentId
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Verify we now have 4 total jobs (2 cancelled + 2 pending)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 4 {
		t.Fatalf("expected 4 total jobs, got %d", len(allJobs))
	}

	// Verify only 2 are pending (both should be v2.0.0)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs after v2.0.0, got %d", len(pendingJobs))
	}

	// Verify all pending jobs are for v2.0.0
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found for job %s", job.Id)
		}
		if release.Version.Tag != "v2.0.0" {
			t.Fatalf("expected all pending jobs to be v2.0.0, got %s", release.Version.Tag)
		}
	}

	// Count cancelled jobs - should be 2 (both v1.0.0 jobs)
	cancelledCount := 0
	for _, job := range allJobs {
		if job.Status == oapi.Cancelled {
			cancelledCount++
			// Verify cancelled jobs are v1.0.0
			release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
			if !ok {
				t.Fatalf("release not found for cancelled job %s", job.Id)
			}
			if release.Version.Tag != "v1.0.0" {
				t.Fatalf("expected cancelled jobs to be v1.0.0, got %s", release.Version.Tag)
			}
		}
	}

	if cancelledCount != 2 {
		t.Fatalf("expected 2 cancelled jobs, got %d", cancelledCount)
	}
}
