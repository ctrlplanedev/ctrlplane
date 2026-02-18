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

func TestEngine_DeploymentVariableDeletion_RemovesVariable(t *testing.T) {
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"db_url",
					integration.DeploymentVariableDefaultStringValue("postgres://localhost"),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("postgres://prod"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
	)

	ctx := context.Background()

	// Verify variable exists
	vars := engine.Workspace().DeploymentVariables().Items()
	assert.Len(t, vars, 1)

	var variable *oapi.DeploymentVariable
	for _, v := range vars {
		variable = v
		break
	}
	assert.Equal(t, "db_url", variable.Key)
	assert.Equal(t, deploymentID, variable.DeploymentId)

	// Verify variable values exist
	values := engine.Workspace().DeploymentVariableValues().Items()
	assert.NotEmpty(t, values)

	// Delete the variable
	engine.PushEvent(ctx, handler.DeploymentVariableDelete, variable)

	// Verify variable is removed
	vars = engine.Workspace().DeploymentVariables().Items()
	assert.Len(t, vars, 0)
}

func TestEngine_DeploymentVariableValueDeletion_RemovesValue(t *testing.T) {
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"db_url",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("postgres://prod"),
					),
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("postgres://staging"),
						integration.DeploymentVariableValuePriority(10),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
	)

	ctx := context.Background()

	// Get all values
	values := engine.Workspace().DeploymentVariableValues().Items()
	assert.Len(t, values, 2)

	// Delete one value
	var valueToDelete *oapi.DeploymentVariableValue
	for _, v := range values {
		valueToDelete = v
		break
	}
	engine.PushEvent(ctx, handler.DeploymentVariableValueDelete, valueToDelete)

	// Verify only one value remains
	values = engine.Workspace().DeploymentVariableValues().Items()
	assert.Len(t, values, 1)
}

func TestEngine_DeploymentVariableDeletion_TriggersRecomputation(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
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
				integration.WithDeploymentVariable(
					"db_url",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("postgres://prod"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create a version to trigger job creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created with both variables
	rt := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(rt)
	assert.Len(t, jobs, 1)

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}
	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)
	_, hasAppName := (*job.DispatchContext.Variables)["app_name"]
	_, hasDbUrl := (*job.DispatchContext.Variables)["db_url"]
	assert.True(t, hasAppName)
	assert.True(t, hasDbUrl)

	// Find and delete the db_url variable
	vars := engine.Workspace().DeploymentVariables().Items()
	for _, v := range vars {
		if v.Key == "db_url" {
			engine.PushEvent(ctx, handler.DeploymentVariableDelete, v)
			break
		}
	}

	// Verify variable was removed
	vars = engine.Workspace().DeploymentVariables().Items()
	assert.Len(t, vars, 1)
	for _, v := range vars {
		assert.Equal(t, "app_name", v.Key)
	}
}

func TestEngine_DeploymentVariableValueDeletion_AllValuesRemoved(t *testing.T) {
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"config",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("value-1"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
	)

	ctx := context.Background()

	// Get the single value
	values := engine.Workspace().DeploymentVariableValues().Items()
	assert.Len(t, values, 1)

	// Delete it
	for _, v := range values {
		engine.PushEvent(ctx, handler.DeploymentVariableValueDelete, v)
	}

	// Verify no values remain
	values = engine.Workspace().DeploymentVariableValues().Items()
	assert.Len(t, values, 0)

	// Variable itself should still exist
	vars := engine.Workspace().DeploymentVariables().Items()
	assert.Len(t, vars, 1)
}
