package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestEngine_ResourceVariableCreation(t *testing.T) {
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
			integration.WithResourceVariable(
				"env",
				integration.ResourceVariableStringValue("production"),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(3),
			),
			integration.WithResourceVariable(
				"enabled",
				integration.ResourceVariableBoolValue(true),
			),
		),
	)

	// Verify the resource exists
	resource, exists := engine.Workspace().Resources().Get(resourceID)
	if !exists {
		t.Fatalf("resource not found")
	}

	if resource.Name != "my-resource" {
		t.Fatalf("resource name is %s, want my-resource", resource.Name)
	}

	// Verify the resource variables were created
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 3 {
		t.Fatalf("resource variables count is %d, want 3", len(variables))
	}

	// Check env variable
	envVar, exists := variables["env"]
	if !exists {
		t.Fatalf("env variable not found")
	}

	value, _ := envVar.Value.AsLiteralValue()
	valueStr, _ := value.AsStringValue()
	if valueStr != "production" {
		t.Fatalf("env variable value is %s, want production", valueStr)
	}

	// Check replicas variable
	replicasVar, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}

	value, _ = replicasVar.Value.AsLiteralValue()
	valueInt, _ := value.AsIntegerValue()
	if valueInt != 3 {
		t.Fatalf("replicas variable value is %d, want 3", valueInt)
	}

	// Check enabled variable
	enabledVar, exists := variables["enabled"]
	if !exists {
		t.Fatalf("enabled variable not found")
	}

	value, _ = enabledVar.Value.AsLiteralValue()
	valueBool, _ := value.AsBooleanValue()
	if !valueBool {
		t.Fatalf("enabled variable value is %v, want true", enabledVar)
	}
}

func TestEngine_ResourceVariableReferenceValue(t *testing.T) {
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
			integration.WithResourceVariable(
				"vpc_id",
				integration.ResourceVariableReferenceValue("vpc-relationship", []string{"id"}),
			),
		),
	)

	// Verify the resource variable was created with reference
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 1 {
		t.Fatalf("resource variables count is %d, want 1", len(variables))
	}

	vpcVar, exists := variables["vpc_id"]
	if !exists {
		t.Fatalf("vpc_id variable not found")
	}

	refValue, _ := vpcVar.Value.AsReferenceValue()

	if refValue.Reference != "vpc-relationship" {
		t.Fatalf("reference value is %s, want vpc-relationship", refValue.Reference)
	}

	if len(refValue.Path) != 1 || refValue.Path[0] != "id" {
		t.Fatalf("reference path is %v, want [id]", refValue.Path)
	}
}

func TestEngine_ResourceVariableUpdate(t *testing.T) {
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
			integration.WithResourceVariable(
				"env",
				integration.ResourceVariableStringValue("staging"),
			),
		),
	)

	// Verify initial value
	variables := engine.Workspace().Resources().Variables(resourceID)
	envVar := variables["env"]

	envValue, _ := envVar.Value.AsLiteralValue()
	envValueStr, _ := envValue.AsStringValue()
	if envValueStr != "staging" {
		t.Fatalf("initial env value is %s, want staging", envValueStr)
	}

	// Update the variable
	ctx := context.Background()
	updatedVar := c.NewResourceVariable(resourceID, "env")
	updatedVar.Value = *c.NewValueFromString("production")
	engine.PushEvent(ctx, handler.ResourceVariableUpdate, updatedVar)

	// Verify updated value
	variables = engine.Workspace().Resources().Variables(resourceID)
	envVar = variables["env"]

	lv, _ := envVar.Value.AsLiteralValue()
	if v, _ := lv.AsStringValue(); v != "production" {
		t.Fatalf("updated env value is %s, want production", v)
	}
}

func TestEngine_ResourceVariableDelete(t *testing.T) {
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
			integration.WithResourceVariable(
				"env",
				integration.ResourceVariableStringValue("production"),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(3),
			),
		),
	)

	// Verify both variables exist
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 2 {
		t.Fatalf("resource variables count is %d, want 2", len(variables))
	}

	// Delete one variable
	ctx := context.Background()
	varToDelete := c.NewResourceVariable(resourceID, "env")
	engine.PushEvent(ctx, handler.ResourceVariableDelete, varToDelete)

	// Verify only one variable remains
	variables = engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 1 {
		t.Fatalf("resource variables count after delete is %d, want 1", len(variables))
	}

	// Verify the remaining variable is replicas
	_, envExists := variables["env"]
	if envExists {
		t.Fatalf("env variable should have been deleted")
	}

	_, replicasExists := variables["replicas"]
	if !replicasExists {
		t.Fatalf("replicas variable should still exist")
	}
}

func TestEngine_ResourceVariableLiteralValue(t *testing.T) {
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
			integration.WithResourceVariable(
				"config",
				integration.ResourceVariableLiteralValue(map[string]any{
					"nested": map[string]any{
						"key": "value",
					},
					"number": 42,
				}),
			),
		),
	)

	// Verify the resource variable was created with object value
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 1 {
		t.Fatalf("resource variables count is %d, want 1", len(variables))
	}

	configVar, exists := variables["config"]
	if !exists {
		t.Fatalf("config variable not found")
	}

	lv, _ := configVar.Value.AsLiteralValue()
	objValue, _ := lv.AsObjectValue()
	if objValue.Object == nil {
		t.Fatalf("object value is nil")
	}

	nestedField := objValue.Object["nested"]
	if nestedField == nil {
		t.Fatalf("nested field not found")
	}
}

func TestEngine_ResourceVariablesBulkUpdate_RemoveVariable(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	dvID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("env"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(dvID),
				),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("resource-1"),
			integration.WithResourceVariable("env", integration.ResourceVariableStringValue("production")),
		),
	)

	ctx := context.Background()
	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables:  map[string]any{},
	})

	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}

	assert.Len(t, pendingJobsSlice, 1, "pending jobs count is %d, want 1", len(pendingJobsSlice))

	job := pendingJobsSlice[0]
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release not found")
	}

	variables := release.Variables
	assert.Len(t, variables, 0, "variables count is %d, want 0", len(variables))
}

func TestEngine_ResourceVariablesBulkUpdate_AddVariable(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("env"),
				integration.WithDeploymentVariable("app_name"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("resource-1"),
			integration.WithResourceVariable("env", integration.ResourceVariableStringValue("production")),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}

	assert.Len(t, pendingJobsSlice, 1, "pending jobs count is %d, want 1", len(pendingJobsSlice))

	job := pendingJobsSlice[0]
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release not found")
	}

	variables := release.Variables
	assert.Len(t, variables, 1, "variables count is %d, want 1", len(variables))
	assert.Equal(t, "production", variables["env"].String(), "env variable value is %s, want production", variables["env"].String())

	now := time.Now()
	jobWithStatusSuccessful := oapi.Job{
		Id:          job.Id,
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &now,
	}

	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id:  &job.Id,
		Job: jobWithStatusSuccessful,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables: map[string]any{
			"app_name": "my-app",
			"env":      "production",
		},
	})

	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}

	assert.Len(t, pendingJobsSlice, 1, "pending jobs count is %d, want 1", len(pendingJobsSlice))

	job = pendingJobsSlice[0]
	release, ok = engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release not found")
	}

	variables = release.Variables
	assert.Len(t, variables, 2, "variables count is %d, want 2", len(variables))
	assert.Equal(t, "my-app", variables["app_name"].String(), "app_name variable value is %s, want my-app", variables["app_name"].String())
	assert.Equal(t, "production", variables["env"].String(), "env variable value is %s, want production", variables["env"].String())
}

func TestEngine_ResourceVariablesBulkUpdate_UpdateVariable(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("env"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("resource-1"),
			integration.WithResourceVariable("env", integration.ResourceVariableStringValue("production")),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}

	assert.Len(t, pendingJobsSlice, 1, "pending jobs count is %d, want 1", len(pendingJobsSlice))

	job := pendingJobsSlice[0]
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release not found")
	}

	variables := release.Variables
	assert.Len(t, variables, 1, "variables count is %d, want 1", len(variables))
	assert.Equal(t, "production", variables["env"].String(), "env variable value is %s, want production", variables["env"].String())

	now := time.Now()
	jobWithStatusSuccessful := oapi.Job{
		Id:          job.Id,
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &now,
	}

	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id:  &job.Id,
		Job: jobWithStatusSuccessful,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables: map[string]any{
			"env": "staging",
		},
	})

	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}

	assert.Len(t, pendingJobsSlice, 1, "pending jobs count is %d, want 1", len(pendingJobsSlice))

	job = pendingJobsSlice[0]
	release, ok = engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release not found")
	}

	variables = release.Variables
	assert.Len(t, variables, 1, "variables count is %d, want 1", len(variables))
	assert.Equal(t, "staging", variables["env"].String(), "env variable value is %s, want staging", variables["env"].String())
}

// TestEngine_ResourceVariablesBulkUpdate_OverridesDeploymentDefault tests that a
// bulk resource variable update overrides the deployment variable default value.
func TestEngine_ResourceVariablesBulkUpdate_OverridesDeploymentDefault(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.DeploymentVariableDefaultStringValue("us-west-2"),
				),
				integration.WithDeploymentVariable(
					"replicas",
					integration.DeploymentVariableDefaultIntValue(3),
				),
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

	// Verify initial release uses deployment defaults
	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	initialJob := pendingJobsSlice[0]
	initialRelease, ok := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	assert.True(t, ok)

	initialRegion, _ := initialRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "us-west-2", initialRegion, "initial region should be deployment default")
	initialReplicas, _ := initialRelease.Variables["replicas"].AsIntegerValue()
	assert.Equal(t, 3, initialReplicas, "initial replicas should be deployment default")

	// Mark initial job as successful
	now := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &initialJob.Id,
		Job: oapi.Job{
			Id:          initialJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Bulk update: set resource variables that should override deployment defaults
	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables: map[string]any{
			"region":   "eu-central-1",
			"replicas": 10,
		},
	})

	// Verify new release uses resource variable values
	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1, "bulk update should trigger a new job")

	newJob := pendingJobsSlice[0]
	newRelease, ok := engine.Workspace().Releases().Get(newJob.ReleaseId)
	assert.True(t, ok)

	newRegion, _ := newRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "eu-central-1", newRegion, "resource variable should override deployment default")

	newReplicas, _ := newRelease.Variables["replicas"].AsIntegerValue()
	assert.Equal(t, 10, newReplicas, "resource variable should override deployment default")

	assert.NotNil(t, newJob.DispatchContext)
	assert.NotNil(t, newJob.DispatchContext.Variables)
	dcRegion, err := (*newJob.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "eu-central-1", dcRegion)
	dcReplicas, err := (*newJob.DispatchContext.Variables)["replicas"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 10, dcReplicas)
}

// TestEngine_ResourceVariablesBulkUpdate_OverridesDeploymentVariableValue tests that a
// bulk resource variable update overrides a deployment variable value (with selector).
func TestEngine_ResourceVariablesBulkUpdate_OverridesDeploymentVariableValue(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("us-east-1"),
						integration.DeploymentVariableValuePriority(10),
					),
				),
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

	// Verify initial release uses deployment variable value
	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	initialJob := pendingJobsSlice[0]
	initialRelease, ok := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	assert.True(t, ok)

	initialRegion, _ := initialRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "us-east-1", initialRegion, "initial region should come from deployment variable value")

	// Mark initial job as successful
	now := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &initialJob.Id,
		Job: oapi.Job{
			Id:          initialJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Bulk update: set resource variable that should override deployment variable value
	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables: map[string]any{
			"region": "ap-southeast-1",
		},
	})

	// Verify new release uses resource variable
	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1, "bulk update should trigger a new job")

	newJob := pendingJobsSlice[0]
	newRelease, ok := engine.Workspace().Releases().Get(newJob.ReleaseId)
	assert.True(t, ok)

	newRegion, _ := newRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "ap-southeast-1", newRegion, "resource variable should override deployment variable value")

	assert.NotNil(t, newJob.DispatchContext)
	assert.NotNil(t, newJob.DispatchContext.Variables)
	dcRegion, err := (*newJob.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "ap-southeast-1", dcRegion)
}

// TestEngine_ResourceVariablesBulkUpdate_PartialOverride tests that bulk update
// overrides only the matching deployment variables while others fall back to defaults.
func TestEngine_ResourceVariablesBulkUpdate_PartialOverride(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.DeploymentVariableDefaultStringValue("us-west-2"),
				),
				integration.WithDeploymentVariable(
					"replicas",
					integration.DeploymentVariableDefaultIntValue(3),
				),
				integration.WithDeploymentVariable(
					"debug",
					integration.DeploymentVariableDefaultBoolValue(false),
				),
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

	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	initialJob := pendingJobsSlice[0]
	now := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &initialJob.Id,
		Job: oapi.Job{
			Id:          initialJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Bulk update: override only "region", leave replicas and debug to deployment defaults
	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables: map[string]any{
			"region": "eu-west-1",
		},
	})

	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	newJob := pendingJobsSlice[0]
	newRelease, ok := engine.Workspace().Releases().Get(newJob.ReleaseId)
	assert.True(t, ok)

	assert.Len(t, newRelease.Variables, 3, "all three deployment variables should be resolved")

	region, _ := newRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "eu-west-1", region, "region should be overridden by resource variable")

	replicas, _ := newRelease.Variables["replicas"].AsIntegerValue()
	assert.Equal(t, 3, replicas, "replicas should fall back to deployment default")

	debug, _ := newRelease.Variables["debug"].AsBooleanValue()
	assert.Equal(t, false, debug, "debug should fall back to deployment default")

	assert.NotNil(t, newJob.DispatchContext)
	assert.NotNil(t, newJob.DispatchContext.Variables)
	dcRegion, err := (*newJob.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "eu-west-1", dcRegion)
	dcReplicas, err := (*newJob.DispatchContext.Variables)["replicas"].AsIntegerValue()
	assert.NoError(t, err)
	assert.Equal(t, 3, dcReplicas)
	dcDebug, err := (*newJob.DispatchContext.Variables)["debug"].AsBooleanValue()
	assert.NoError(t, err)
	assert.Equal(t, false, dcDebug)
}

// TestEngine_ResourceVariablesBulkUpdate_SecondBulkUpdateRemovesOverride tests that
// a second bulk update without the overriding key causes fallback to deployment default.
func TestEngine_ResourceVariablesBulkUpdate_SecondBulkUpdateRemovesOverride(t *testing.T) {
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.DeploymentVariableDefaultStringValue("us-west-2"),
				),
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

	pendingJobs := engine.Workspace().Jobs().GetPending()
	pendingJobsSlice := make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	initialJob := pendingJobsSlice[0]
	now := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &initialJob.Id,
		Job: oapi.Job{
			Id:          initialJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// First bulk update: override region
	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables: map[string]any{
			"region": "eu-west-1",
		},
	})

	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	overrideJob := pendingJobsSlice[0]
	overrideRelease, ok := engine.Workspace().Releases().Get(overrideJob.ReleaseId)
	assert.True(t, ok)

	overrideRegion, _ := overrideRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "eu-west-1", overrideRegion, "region should be overridden by resource variable")

	// Mark job as successful
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &overrideJob.Id,
		Job: oapi.Job{
			Id:          overrideJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Second bulk update: empty variables removes the override
	engine.PushEvent(ctx, handler.ResourceVariablesBulkUpdate, oapi.ResourceVariablesBulkUpdateEvent{
		ResourceId: resourceID,
		Variables:  map[string]any{},
	})

	pendingJobs = engine.Workspace().Jobs().GetPending()
	pendingJobsSlice = make([]*oapi.Job, 0, len(pendingJobs))
	for _, job := range pendingJobs {
		pendingJobsSlice = append(pendingJobsSlice, job)
	}
	assert.Len(t, pendingJobsSlice, 1)

	revertJob := pendingJobsSlice[0]
	revertRelease, ok := engine.Workspace().Releases().Get(revertJob.ReleaseId)
	assert.True(t, ok)

	revertRegion, _ := revertRelease.Variables["region"].AsStringValue()
	assert.Equal(t, "us-west-2", revertRegion, "region should fall back to deployment default after resource variable removed")

	assert.NotNil(t, revertJob.DispatchContext)
	assert.NotNil(t, revertJob.DispatchContext.Variables)
	dcRegion, err := (*revertJob.DispatchContext.Variables)["region"].AsStringValue()
	assert.NoError(t, err)
	assert.Equal(t, "us-west-2", dcRegion)
}
