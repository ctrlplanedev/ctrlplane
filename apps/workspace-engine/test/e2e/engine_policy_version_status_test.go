package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestEngine_PolicyVersionStatusReady tests that a policy only allows deployments
// with versions whose status is "ready"
func TestEngine_PolicyVersionStatusReady(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("ready-versions-only"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Create a deployment version with status "building" (should NOT create jobs)
	versionBuilding := c.NewDeploymentVersion()
	versionBuilding.DeploymentId = deploymentID
	versionBuilding.Tag = "v1.0.0"
	versionBuilding.Status = oapi.DeploymentVersionStatusBuilding
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionBuilding)

	// Verify NO jobs were created for building version
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs for building version, got %d", len(allJobs))
	}

	// Create a deployment version with status "failed" (should NOT create jobs)
	versionFailed := c.NewDeploymentVersion()
	versionFailed.DeploymentId = deploymentID
	versionFailed.Tag = "v1.1.0"
	versionFailed.Status = oapi.DeploymentVersionStatusFailed
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionFailed)

	// Verify NO jobs were created for failed version
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs for failed version, got %d", len(allJobs))
	}

	// Create a deployment version with status "rejected" (should NOT create jobs)
	versionRejected := c.NewDeploymentVersion()
	versionRejected.DeploymentId = deploymentID
	versionRejected.Tag = "v1.2.0"
	versionRejected.Status = oapi.DeploymentVersionStatusRejected
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionRejected)

	// Verify NO jobs were created for rejected version
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs for rejected version, got %d", len(allJobs))
	}

	// Create a deployment version with status "ready" (SHOULD create jobs)
	versionReady := c.NewDeploymentVersion()
	versionReady.DeploymentId = deploymentID
	versionReady.Tag = "v2.0.0"
	versionReady.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionReady)

	// Verify job WAS created for ready version
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job for ready version, got %d", len(allJobs))
	}

	// Verify the job is for the correct version
	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.Version.Tag != "v2.0.0" {
		t.Fatalf("expected version v2.0.0, got %s", release.Version.Tag)
	}
	if release.Version.Status != oapi.DeploymentVersionStatusReady {
		t.Fatalf("expected version status ready, got %s", release.Version.Status)
	}
	if job.Status != oapi.JobStatusPending {
		t.Fatalf("expected job status Pending, got %s", job.Status)
	}
	assert.NotNil(t, job.DispatchContext)
}

// TestEngine_PolicyVersionStatusReady_StatusUpdate tests that when a deployment version
// status changes from non-ready to ready, jobs are created
func TestEngine_PolicyVersionStatusReady_StatusUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("ready-versions-only"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Create a deployment version with status "building"
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	version.Status = oapi.DeploymentVersionStatusBuilding
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify NO jobs were created
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs for building version, got %d", len(allJobs))
	}

	// Update the version status to "ready"
	updatedVersion, ok := engine.Workspace().DeploymentVersions().Get(version.Id)
	if !ok {
		t.Fatalf("version %s not found", version.Id)
	}
	updatedVersion.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, updatedVersion)

	// Verify job WAS created after status update
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after status update to ready, got %d", len(allJobs))
	}

	// Verify the job is for the correct version
	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.Version.Tag != "v1.0.0" {
		t.Fatalf("expected version v1.0.0, got %s", release.Version.Tag)
	}
	if release.Version.Status != oapi.DeploymentVersionStatusReady {
		t.Fatalf("expected version status ready, got %s", release.Version.Status)
	}
}

// TestEngine_PolicyVersionStatusReady_MultipleDeployments tests that the policy
// correctly filters versions across multiple deployments
func TestEngine_PolicyVersionStatusReady_MultipleDeployments(t *testing.T) {
	jobAgentID := uuid.New().String()
	deployment1ID := uuid.New().String()
	deployment2ID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("worker-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("ready-versions-only"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Create building version for deployment 1 (should NOT create job)
	version1Building := c.NewDeploymentVersion()
	version1Building.DeploymentId = deployment1ID
	version1Building.Tag = "v1.0.0"
	version1Building.Status = oapi.DeploymentVersionStatusBuilding
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1Building)

	// Create ready version for deployment 2 (SHOULD create job)
	version2Ready := c.NewDeploymentVersion()
	version2Ready.DeploymentId = deployment2ID
	version2Ready.Tag = "v1.0.0"
	version2Ready.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2Ready)

	// Verify only 1 job was created (for deployment 2)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job (only for ready version), got %d", len(allJobs))
	}

	// Verify the job is for deployment 2
	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.ReleaseTarget.DeploymentId != deployment2ID {
		t.Fatalf("expected job for deployment %s, got %s", deployment2ID, release.ReleaseTarget.DeploymentId)
	}

	// Now create a ready version for deployment 1 (SHOULD create job)
	version1Ready := c.NewDeploymentVersion()
	version1Ready.DeploymentId = deployment1ID
	version1Ready.Tag = "v2.0.0"
	version1Ready.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1Ready)

	// Verify now we have 2 jobs total
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs total, got %d", len(allJobs))
	}

	// Verify both deployments have jobs
	deploymentsWithJobs := make(map[string]bool)
	for _, j := range allJobs {
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if !ok {
			continue
		}
		deploymentsWithJobs[release.ReleaseTarget.DeploymentId] = true
	}

	if !deploymentsWithJobs[deployment1ID] {
		t.Fatalf("expected job for deployment %s", deployment1ID)
	}
	if !deploymentsWithJobs[deployment2ID] {
		t.Fatalf("expected job for deployment %s", deployment2ID)
	}
}

// TestEngine_PolicyVersionStatusReady_WithSelector tests that the policy
// only applies to selected deployments
func TestEngine_PolicyVersionStatusReady_WithSelector(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentProdID := uuid.New().String()
	deploymentDevID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentProdID),
				integration.DeploymentName("api-service-prod"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentDevID),
				integration.DeploymentName("api-service-dev"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		// Create policy that only targets prod deployments
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("ready-versions-only-prod"),
			integration.WithPolicySelector("deployment.name.contains('prod')"),
		),
	)

	ctx := context.Background()

	// Create building version for prod deployment (should NOT create job - not ready)
	versionProdBuilding := c.NewDeploymentVersion()
	versionProdBuilding.DeploymentId = deploymentProdID
	versionProdBuilding.Tag = "v1.0.0"
	versionProdBuilding.Status = oapi.DeploymentVersionStatusBuilding
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionProdBuilding)

	// Create building version for dev deployment (should also NOT create job - not ready)
	versionDevBuilding := c.NewDeploymentVersion()
	versionDevBuilding.DeploymentId = deploymentDevID
	versionDevBuilding.Tag = "v1.0.0"
	versionDevBuilding.Status = oapi.DeploymentVersionStatusBuilding
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionDevBuilding)

	// Verify NO jobs were created (building versions are never deployable)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 0 {
		t.Fatalf("expected 0 jobs for building versions (never deployable), got %d", len(allJobs))
	}

	// Create ready version for dev deployment (should create job - no policy restrictions)
	versionDevReady := c.NewDeploymentVersion()
	versionDevReady.DeploymentId = deploymentDevID
	versionDevReady.Tag = "v2.0.0"
	versionDevReady.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionDevReady)

	// Verify 1 job was created for dev
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job for dev ready version, got %d", len(allJobs))
	}

	// Create ready version for prod deployment (policy applies, SHOULD create job)
	versionProdReady := c.NewDeploymentVersion()
	versionProdReady.DeploymentId = deploymentProdID
	versionProdReady.Tag = "v2.0.0"
	versionProdReady.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionProdReady)

	// Verify now we have 2 jobs total (both ready versions)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs total (both ready versions), got %d", len(allJobs))
	}

	// Verify both deployments have jobs with ready versions
	devHasJob := false
	prodHasJob := false
	for _, j := range allJobs {
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentDevID && release.Version.Tag == "v2.0.0" {
			devHasJob = true
			if release.Version.Status != oapi.DeploymentVersionStatusReady {
				t.Fatalf("expected dev version status ready, got %s", release.Version.Status)
			}
		}
		if release.ReleaseTarget.DeploymentId == deploymentProdID && release.Version.Tag == "v2.0.0" {
			prodHasJob = true
			if release.Version.Status != oapi.DeploymentVersionStatusReady {
				t.Fatalf("expected prod version status ready, got %s", release.Version.Status)
			}
		}
	}

	if !devHasJob {
		t.Fatalf("expected job for dev deployment with ready version")
	}
	if !prodHasJob {
		t.Fatalf("expected job for prod deployment with ready version")
	}
}
