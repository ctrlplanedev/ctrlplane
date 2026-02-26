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

// TestEngine_DeploymentVariableValue_LiteralStringValue tests literal string values resolve correctly
func TestEngine_DeploymentVariableValue_LiteralStringValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"app_name",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("my-app"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	dispatchAppName, err := (*job.DispatchContext.Variables)["app_name"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "my-app", dispatchAppName)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	appName, exists := variables["app_name"]
	if !exists {
		t.Fatalf("app_name variable not found")
	}
	appNameStr, _ := appName.AsStringValue()
	if appNameStr != "my-app" {
		t.Errorf("app_name = %s, want my-app", appNameStr)
	}
}

// TestEngine_DeploymentVariableValue_LiteralIntValue tests literal integer values resolve correctly
func TestEngine_DeploymentVariableValue_LiteralIntValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"replicas",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueIntValue(5),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	replicasVal, err := (*job.DispatchContext.Variables)["replicas"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 5, replicasVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasInt, _ := replicas.AsIntegerValue()
	if int64(replicasInt) != 5 {
		t.Errorf("replicas = %d, want 5", replicasInt)
	}
}

// TestEngine_DeploymentVariableValue_LiteralBoolValue tests literal boolean values resolve correctly
func TestEngine_DeploymentVariableValue_LiteralBoolValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"enable_debug",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueBoolValue(true),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	dispatchEnableDebug, err := (*job.DispatchContext.Variables)["enable_debug"].AsBooleanValue()
	assert.NoError(t, err)
	assert.Equal(t, true, dispatchEnableDebug)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	enableDebug, exists := variables["enable_debug"]
	if !exists {
		t.Fatalf("enable_debug variable not found")
	}
	enableDebugBool, _ := enableDebug.AsBooleanValue()
	if !enableDebugBool {
		t.Errorf("enable_debug = %v, want true", enableDebugBool)
	}
}

// TestEngine_DeploymentVariableValue_LiteralObjectValue tests literal object values resolve correctly
func TestEngine_DeploymentVariableValue_LiteralObjectValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"config",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueLiteralValue(map[string]any{
							"timeout": 30,
							"retries": 3,
							"enabled": true,
						}),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	config, exists := variables["config"]
	if !exists {
		t.Fatalf("config variable not found")
	}

	obj, err := config.AsObjectValue()
	if err != nil {
		t.Fatalf("config is not an object: %v", err)
	}

	if obj.Object["timeout"] != float64(30) {
		t.Errorf("timeout = %v, want 30", obj.Object["timeout"])
	}

	if obj.Object["retries"] != float64(3) {
		t.Errorf("retries = %v, want 3", obj.Object["retries"])
	}

	if obj.Object["enabled"] != true {
		t.Errorf("enabled = %v, want true", obj.Object["enabled"])
	}
}

// TestEngine_DeploymentVariableValue_ResourceSelectorMatching tests values with selectors that match resources
func TestEngine_DeploymentVariableValue_ResourceSelectorMatching(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID1 := uuid.New().String()
	resourceID2 := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("resource.metadata.env == 'production'"),
						integration.DeploymentVariableValueStringValue("us-east-1"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID1),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "production",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID2),
			integration.ResourceName("server-2"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "staging",
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (matches selector)
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID1,
	}

	jobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget1)
	if len(jobs1) != 1 {
		t.Fatalf("expected 1 job for resource 1, got %d", len(jobs1))
	}

	var job1 *oapi.Job
	for _, j := range jobs1 {
		job1 = j
		break
	}

	assert.NotNil(t, job1.DispatchContext)
	assert.Equal(t, jobAgentID, job1.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job1.DispatchContext.Release)
	assert.NotNil(t, job1.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job1.DispatchContext.Deployment.Id)
	assert.NotNil(t, job1.DispatchContext.Environment)
	assert.Equal(t, environmentID, job1.DispatchContext.Environment.Id)
	assert.NotNil(t, job1.DispatchContext.Resource)
	assert.Equal(t, resourceID1, job1.DispatchContext.Resource.Id)
	assert.NotNil(t, job1.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job1.DispatchContext.Version.Tag)
	assert.NotNil(t, job1.DispatchContext.Variables)
	dispatchRegion1, err := (*job1.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "us-east-1", dispatchRegion1)

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 1")
	}

	variables1 := release1.Variables
	region1, exists := variables1["region"]
	if !exists {
		t.Fatalf("region variable not found for resource 1")
	}
	region1Str, _ := region1.AsStringValue()
	if region1Str != "us-east-1" {
		t.Errorf("resource 1 region = %s, want us-east-1", region1Str)
	}

	// Test resource 2 (doesn't match selector) - should not have region variable
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID2,
	}

	jobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget2)
	if len(jobs2) != 1 {
		t.Fatalf("expected 1 job for resource 2, got %d", len(jobs2))
	}

	var job2 *oapi.Job
	for _, j := range jobs2 {
		job2 = j
		break
	}

	assert.NotNil(t, job2.DispatchContext)
	assert.Equal(t, jobAgentID, job2.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job2.DispatchContext.Release)
	assert.NotNil(t, job2.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job2.DispatchContext.Deployment.Id)
	assert.NotNil(t, job2.DispatchContext.Environment)
	assert.Equal(t, environmentID, job2.DispatchContext.Environment.Id)
	assert.NotNil(t, job2.DispatchContext.Resource)
	assert.Equal(t, resourceID2, job2.DispatchContext.Resource.Id)
	assert.NotNil(t, job2.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job2.DispatchContext.Version.Tag)
	if job2.DispatchContext.Variables != nil {
		_, hasRegion := (*job2.DispatchContext.Variables)["region"]
		assert.False(t, hasRegion, "job2 should not have region variable")
	}

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 2")
	}

	variables2 := release2.Variables
	_, exists = variables2["region"]
	if exists {
		t.Errorf("resource 2 should not have region variable (selector doesn't match)")
	}
}

// TestEngine_DeploymentVariableValue_ResourceSelectorNotMatching tests values with selectors that don't match, fallback to default
func TestEngine_DeploymentVariableValue_ResourceSelectorNotMatching(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.DeploymentVariableDefaultStringValue("us-west-2"),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("resource.metadata.env == 'production'"),
						integration.DeploymentVariableValueStringValue("us-east-1"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "staging", // Doesn't match selector
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	dispatchRegion, err := (*job.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "us-west-2", dispatchRegion)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	region, exists := variables["region"]
	if !exists {
		t.Fatalf("region variable not found")
	}
	regionStr, _ := region.AsStringValue()
	if regionStr != "us-west-2" {
		t.Errorf("region = %s, want us-west-2 (default value)", regionStr)
	}
}

// TestEngine_DeploymentVariableValue_NoResourceSelector tests values without selectors match all resources
func TestEngine_DeploymentVariableValue_NoResourceSelector(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID1 := uuid.New().String()
	resourceID2 := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"app_version",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("v1.0.0"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID1),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
		integration.WithResource(
			integration.ResourceID(resourceID2),
			integration.ResourceName("server-2"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID1,
	}

	jobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget1)
	if len(jobs1) != 1 {
		t.Fatalf("expected 1 job for resource 1, got %d", len(jobs1))
	}

	var job1 *oapi.Job
	for _, j := range jobs1 {
		job1 = j
		break
	}

	assert.NotNil(t, job1.DispatchContext)
	assert.Equal(t, jobAgentID, job1.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job1.DispatchContext.Release)
	assert.NotNil(t, job1.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job1.DispatchContext.Deployment.Id)
	assert.NotNil(t, job1.DispatchContext.Environment)
	assert.Equal(t, environmentID, job1.DispatchContext.Environment.Id)
	assert.NotNil(t, job1.DispatchContext.Resource)
	assert.Equal(t, resourceID1, job1.DispatchContext.Resource.Id)
	assert.NotNil(t, job1.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job1.DispatchContext.Version.Tag)
	assert.NotNil(t, job1.DispatchContext.Variables)
	dispatchVersion1, err := (*job1.DispatchContext.Variables)["app_version"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "v1.0.0", dispatchVersion1)

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 1")
	}

	variables1 := release1.Variables
	version1, exists := variables1["app_version"]
	if !exists {
		t.Fatalf("app_version variable not found for resource 1")
	}
	version1Str, _ := version1.AsStringValue()
	if version1Str != "v1.0.0" {
		t.Errorf("resource 1 app_version = %s, want v1.0.0", version1Str)
	}

	// Test resource 2
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID2,
	}

	jobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget2)
	if len(jobs2) != 1 {
		t.Fatalf("expected 1 job for resource 2, got %d", len(jobs2))
	}

	var job2 *oapi.Job
	for _, j := range jobs2 {
		job2 = j
		break
	}

	assert.NotNil(t, job2.DispatchContext)
	assert.Equal(t, jobAgentID, job2.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job2.DispatchContext.Release)
	assert.NotNil(t, job2.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job2.DispatchContext.Deployment.Id)
	assert.NotNil(t, job2.DispatchContext.Environment)
	assert.Equal(t, environmentID, job2.DispatchContext.Environment.Id)
	assert.NotNil(t, job2.DispatchContext.Resource)
	assert.Equal(t, resourceID2, job2.DispatchContext.Resource.Id)
	assert.NotNil(t, job2.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job2.DispatchContext.Version.Tag)
	assert.NotNil(t, job2.DispatchContext.Variables)
	dispatchVersion2, err := (*job2.DispatchContext.Variables)["app_version"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "v1.0.0", dispatchVersion2)

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 2")
	}

	variables2 := release2.Variables
	version2, exists := variables2["app_version"]
	if !exists {
		t.Fatalf("app_version variable not found for resource 2")
	}
	version2Str, _ := version2.AsStringValue()
	if version2Str != "v1.0.0" {
		t.Errorf("resource 2 app_version = %s, want v1.0.0", version2Str)
	}
}

// TestEngine_DeploymentVariableValue_MultipleSelectors tests multiple values with different selectors targeting different resources
func TestEngine_DeploymentVariableValue_MultipleSelectors(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID1 := uuid.New().String()
	resourceID2 := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("resource.metadata.env == 'production'"),
						integration.DeploymentVariableValueStringValue("us-east-1"),
					),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("resource.metadata.env == 'staging'"),
						integration.DeploymentVariableValueStringValue("us-west-2"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID1),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "production",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID2),
			integration.ResourceName("server-2"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "staging",
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (production)
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID1,
	}

	jobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget1)
	if len(jobs1) != 1 {
		t.Fatalf("expected 1 job for resource 1, got %d", len(jobs1))
	}

	var job1 *oapi.Job
	for _, j := range jobs1 {
		job1 = j
		break
	}

	assert.NotNil(t, job1.DispatchContext)
	assert.Equal(t, jobAgentID, job1.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job1.DispatchContext.Release)
	assert.NotNil(t, job1.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job1.DispatchContext.Deployment.Id)
	assert.NotNil(t, job1.DispatchContext.Environment)
	assert.Equal(t, environmentID, job1.DispatchContext.Environment.Id)
	assert.NotNil(t, job1.DispatchContext.Resource)
	assert.Equal(t, resourceID1, job1.DispatchContext.Resource.Id)
	assert.NotNil(t, job1.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job1.DispatchContext.Version.Tag)
	assert.NotNil(t, job1.DispatchContext.Variables)
	dispatchRegion1, err := (*job1.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "us-east-1", dispatchRegion1)

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 1")
	}

	variables1 := release1.Variables
	region1, exists := variables1["region"]
	if !exists {
		t.Fatalf("region variable not found for resource 1")
	}
	region1Str, _ := region1.AsStringValue()
	if region1Str != "us-east-1" {
		t.Errorf("resource 1 region = %s, want us-east-1", region1Str)
	}

	// Test resource 2 (staging)
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID2,
	}

	jobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget2)
	if len(jobs2) != 1 {
		t.Fatalf("expected 1 job for resource 2, got %d", len(jobs2))
	}

	var job2 *oapi.Job
	for _, j := range jobs2 {
		job2 = j
		break
	}

	assert.NotNil(t, job2.DispatchContext)
	assert.Equal(t, jobAgentID, job2.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job2.DispatchContext.Release)
	assert.NotNil(t, job2.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job2.DispatchContext.Deployment.Id)
	assert.NotNil(t, job2.DispatchContext.Environment)
	assert.Equal(t, environmentID, job2.DispatchContext.Environment.Id)
	assert.NotNil(t, job2.DispatchContext.Resource)
	assert.Equal(t, resourceID2, job2.DispatchContext.Resource.Id)
	assert.NotNil(t, job2.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job2.DispatchContext.Version.Tag)
	assert.NotNil(t, job2.DispatchContext.Variables)
	dispatchRegion2, err := (*job2.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "us-west-2", dispatchRegion2)

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 2")
	}

	variables2 := release2.Variables
	region2, exists := variables2["region"]
	if !exists {
		t.Fatalf("region variable not found for resource 2")
	}
	region2Str, _ := region2.AsStringValue()
	if region2Str != "us-west-2" {
		t.Errorf("resource 2 region = %s, want us-west-2", region2Str)
	}
}

// TestEngine_DeploymentVariableValue_PriorityOrdering tests that higher priority values take precedence when multiple match
func TestEngine_DeploymentVariableValue_PriorityOrdering(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"replicas",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValuePriority(10),
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("high-priority"),
					),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValuePriority(5),
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("low-priority"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	dispatchReplicas, err := (*job.DispatchContext.Variables)["replicas"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "high-priority", dispatchReplicas)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasStr, _ := replicas.AsStringValue()
	if replicasStr != "high-priority" {
		t.Errorf("replicas = %s, want high-priority (higher priority)", replicasStr)
	}
}

// TestEngine_DeploymentVariableValue_ReferenceValue tests reference values resolve correctly through relationships
func TestEngine_DeploymentVariableValue_ReferenceValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	vpcID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"vpc_id",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueReferenceValue("vpc", []string{"id"}),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
			integration.RelationshipRuleName("cluster-to-vpc"),
			integration.RelationshipRuleReference("vpc"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "vpc_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID(vpcID),
			integration.ResourceName("vpc-main"),
			integration.ResourceKind("vpc"),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-main"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	vpcIDVal, err := (*job.DispatchContext.Variables)["vpc_id"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, vpcID, vpcIDVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	vpcIDVar, exists := variables["vpc_id"]
	if !exists {
		t.Fatalf("vpc_id variable not found")
	}
	vpcIDStr, _ := vpcIDVar.AsStringValue()
	if vpcIDStr != vpcID {
		t.Errorf("vpc_id = %s, want %s", vpcIDStr, vpcID)
	}
}

// TestEngine_DeploymentVariableValue_ReferenceNestedProperty tests reference values with nested property paths
func TestEngine_DeploymentVariableValue_ReferenceNestedProperty(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	dbID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"db_host",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueReferenceValue("database", []string{"metadata", "host"}),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
			integration.RelationshipRuleName("service-to-database"),
			integration.RelationshipRuleReference("database"),
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
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "db_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID(dbID),
			integration.ResourceName("postgres-main"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"host": "db.example.com",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"db_id": dbID,
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	dbHostVal, err := (*job.DispatchContext.Variables)["db_host"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "db.example.com", dbHostVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	dbHost, exists := variables["db_host"]
	if !exists {
		t.Fatalf("db_host variable not found")
	}
	dbHostStr, _ := dbHost.AsStringValue()
	if dbHostStr != "db.example.com" {
		t.Errorf("db_host = %s, want db.example.com", dbHostStr)
	}
}

// TestEngine_DeploymentVariableValue_DefaultValueFallback tests default value used when no values match selector
func TestEngine_DeploymentVariableValue_DefaultValueFallback(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"port",
					integration.DeploymentVariableDefaultIntValue(8080),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("resource.metadata.env == 'production'"),
						integration.DeploymentVariableValueIntValue(3000),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "staging", // Doesn't match selector
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	portVal, err := (*job.DispatchContext.Variables)["port"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 8080, portVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	port, exists := variables["port"]
	if !exists {
		t.Fatalf("port variable not found")
	}
	portInt, _ := port.AsIntegerValue()
	if int64(portInt) != 8080 {
		t.Errorf("port = %d, want 8080 (default value)", portInt)
	}
}

// TestEngine_DeploymentVariableValue_PriorityOverDefault tests priority values override defaults
func TestEngine_DeploymentVariableValue_PriorityOverDefault(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"replicas",
					integration.DeploymentVariableDefaultIntValue(3),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueIntValue(5),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	replicasVal, err := (*job.DispatchContext.Variables)["replicas"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 5, replicasVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasInt, _ := replicas.AsIntegerValue()
	if int64(replicasInt) != 5 {
		t.Errorf("replicas = %d, want 5 (value overrides default)", replicasInt)
	}
}

// TestEngine_DeploymentVariableValue_MultipleValuesSameResource tests multiple values targeting same resource with different priorities
func TestEngine_DeploymentVariableValue_MultipleValuesSameResource(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"timeout",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValuePriority(20),
						integration.DeploymentVariableValueCelResourceSelector("resource.kind == 'server'"),
						integration.DeploymentVariableValueIntValue(60),
					),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValuePriority(10),
						integration.DeploymentVariableValueCelResourceSelector("resource.kind == 'server'"),
						integration.DeploymentVariableValueIntValue(30),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	timeoutVal, err := (*job.DispatchContext.Variables)["timeout"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 60, timeoutVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	timeout, exists := variables["timeout"]
	if !exists {
		t.Fatalf("timeout variable not found")
	}
	timeoutInt, _ := timeout.AsIntegerValue()
	if int64(timeoutInt) != 60 {
		t.Errorf("timeout = %d, want 60 (higher priority)", timeoutInt)
	}
}

// TestEngine_DeploymentVariableValue_EmptyStringValue tests empty string values
func TestEngine_DeploymentVariableValue_EmptyStringValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"optional_value",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue(""),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	optionalVal, err := (*job.DispatchContext.Variables)["optional_value"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "", optionalVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	optionalValue, exists := variables["optional_value"]
	if !exists {
		t.Fatalf("optional_value variable not found")
	}
	optionalValueStr, _ := optionalValue.AsStringValue()
	if optionalValueStr != "" {
		t.Errorf("optional_value = %s, want empty string", optionalValueStr)
	}
}

// TestEngine_DeploymentVariableValue_NilDefaultValue tests behavior when default value is nil and no values match
func TestEngine_DeploymentVariableValue_NilDefaultValue(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"optional_var",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("resource.metadata.env == 'production'"),
						integration.DeploymentVariableValueStringValue("production-value"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"env": "staging", // Doesn't match selector, no default value
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	if job.DispatchContext.Variables != nil {
		_, hasVar := (*job.DispatchContext.Variables)["optional_var"]
		assert.False(t, hasVar, "optional_var should not exist when no values match and no default")
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	_, exists = variables["optional_var"]
	if exists {
		t.Errorf("optional_var should not exist when no values match and no default")
	}
}

// TestEngine_DeploymentVariableValue_MixedLiteralAndReference tests deployment with both literal and reference values
func TestEngine_DeploymentVariableValue_MixedLiteralAndReference(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	dbID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"app_name",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("my-api"),
					),
				),
				integration.WithDeploymentVariable(
					"db_host",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueReferenceValue("database", []string{"metadata", "host"}),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
			integration.RelationshipRuleName("service-to-database"),
			integration.RelationshipRuleReference("database"),
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
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "db_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID(dbID),
			integration.ResourceName("postgres-main"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"host": "db.example.com",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"db_id": dbID,
			}),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	appNameVal, err := (*job.DispatchContext.Variables)["app_name"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "my-api", appNameVal)
	dbHostVal2, err := (*job.DispatchContext.Variables)["db_host"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "db.example.com", dbHostVal2)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	if len(variables) != 2 {
		t.Fatalf("expected 2 variables, got %d", len(variables))
	}

	appName, exists := variables["app_name"]
	if !exists {
		t.Fatalf("app_name variable not found")
	}
	appNameStr, _ := appName.AsStringValue()
	if appNameStr != "my-api" {
		t.Errorf("app_name = %s, want my-api", appNameStr)
	}

	dbHost, exists := variables["db_host"]
	if !exists {
		t.Fatalf("db_host variable not found")
	}
	dbHostStr, _ := dbHost.AsStringValue()
	if dbHostStr != "db.example.com" {
		t.Errorf("db_host = %s, want db.example.com", dbHostStr)
	}
}

// TestEngine_DeploymentVariableValue_ResourceVariableOverride tests resource variables override deployment variable values
func TestEngine_DeploymentVariableValue_ResourceVariableOverride(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"replicas",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueIntValue(3),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(5),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.Equal(t, environmentID, job.DispatchContext.Environment.Id)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.Equal(t, resourceID, job.DispatchContext.Resource.Id)
	assert.NotNil(t, job.DispatchContext.Version)
	assert.Equal(t, "v1.0.0", job.DispatchContext.Version.Tag)
	assert.NotNil(t, job.DispatchContext.Variables)
	replicasVal, err := (*job.DispatchContext.Variables)["replicas"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 5, replicasVal)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasInt, _ := replicas.AsIntegerValue()
	if int64(replicasInt) != 5 {
		t.Errorf("replicas = %d, want 5 (resource variable overrides deployment variable value)", replicasInt)
	}
}
