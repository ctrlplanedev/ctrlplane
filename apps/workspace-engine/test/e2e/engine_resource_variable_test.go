package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/stretchr/testify/assert"
)

func TestEngine_ResourceVariableCreation(t *testing.T) {
	resourceID := "resource-1"

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
	resourceID := "resource-1"

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
	resourceID := "resource-1"

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
	resourceID := "resource-1"

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
	resourceID := "resource-1"

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
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID("job-agent-1"),
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
				integration.DeploymentJobAgent("job-agent-1"),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("env"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID("deployment-version-1"),
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
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID("job-agent-1"),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID("deployment-1"),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent("job-agent-1"),
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
	dv.DeploymentId = "deployment-1"
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
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID("job-agent-1"),
			integration.JobAgentName("my-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID("deployment-1"),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent("job-agent-1"),
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
	dv.DeploymentId = "deployment-1"
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
