package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/workflowmanager"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestEngine_Workflow_BasicFlow(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowStepTemplateID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputName("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowStepTemplate(
				integration.WorkflowStepTemplateID(workflowStepTemplateID),
				integration.WorkflowStepTemplateJobAgentID(jobAgentID),
				integration.WorkflowStepTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowStepTemplateName("Test Step 1"),
			),
		),
	)

	ctx := context.Background()

	workflowCreate := &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
		Inputs: map[string]any{
			"input-1": "custom-1",
		},
	}
	engine.PushEvent(ctx, handler.WorkflowCreate, workflowCreate)

	workflows := engine.Workspace().Workflows().GetByTemplateID(workflowTemplateID)
	assert.Len(t, workflows, 1)
	workflowsSlice := make([]*oapi.Workflow, 0)
	for _, workflow := range workflows {
		workflowsSlice = append(workflowsSlice, workflow)
	}
	workflow := workflowsSlice[0]
	assert.NotNil(t, workflow)
	assert.Equal(t, workflowTemplateID, workflow.WorkflowTemplateId)
	assert.Equal(t, map[string]any{
		"input-1": "custom-1",
	}, workflow.Inputs)

	workflowSteps := engine.Workspace().WorkflowSteps().GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowSteps, 1)
	assert.Equal(t, 0, workflowSteps[0].Index)

	jobs := engine.Workspace().Jobs().GetByWorkflowStepId(workflowSteps[0].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, workflowSteps[0].Id, jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgentID, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, jobs[0].JobAgentConfig)
}

func TestEngine_Workflow_MultipleInputs(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowStepTemplateID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputName("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowNumberInput(
				integration.WorkflowNumberInputName("input-2"),
				integration.WorkflowNumberInputDefault(2),
			),
			integration.WithWorkflowBooleanInput(
				integration.WorkflowBooleanInputName("input-3"),
				integration.WorkflowBooleanInputDefault(true),
			),
			integration.WithWorkflowStepTemplate(
				integration.WorkflowStepTemplateID(workflowStepTemplateID),
				integration.WorkflowStepTemplateJobAgentID(jobAgentID),
				integration.WorkflowStepTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowStepTemplateName("Test Step 1"),
			),
		),
	)

	ctx := context.Background()

	workflowCreate := &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
		Inputs: map[string]any{
			"input-1": "custom-1",
			"input-2": 5,
			"input-3": false,
		},
	}
	engine.PushEvent(ctx, handler.WorkflowCreate, workflowCreate)

	workflows := engine.Workspace().Workflows().GetByTemplateID(workflowTemplateID)
	assert.Len(t, workflows, 1)
	workflowsSlice := make([]*oapi.Workflow, 0)
	for _, workflow := range workflows {
		workflowsSlice = append(workflowsSlice, workflow)
	}
	workflow := workflowsSlice[0]
	assert.NotNil(t, workflow)
	assert.Equal(t, workflowTemplateID, workflow.WorkflowTemplateId)
	assert.Equal(t, map[string]any{
		"input-1": "custom-1",
		"input-2": float64(5),
		"input-3": false,
	}, workflow.Inputs)

	workflowSteps := engine.Workspace().WorkflowSteps().GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowSteps, 1)
	assert.Equal(t, 0, workflowSteps[0].Index)

	jobs := engine.Workspace().Jobs().GetByWorkflowStepId(workflowSteps[0].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, workflowSteps[0].Id, jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgentID, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, jobs[0].JobAgentConfig)
}

func TestEngine_Workflow_MultipleSteps(t *testing.T) {
	jobAgentID1 := uuid.New().String()
	jobAgentID2 := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowStepTemplateID1 := uuid.New().String()
	workflowStepTemplateID2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID1),
			integration.JobAgentName("Test Agent 1"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID2),
			integration.JobAgentName("Test Agent 2"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStepTemplate(
				integration.WorkflowStepTemplateID(workflowStepTemplateID1),
				integration.WorkflowStepTemplateJobAgentID(jobAgentID1),
				integration.WorkflowStepTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowStepTemplateName("Test Step 1"),
			),
			integration.WithWorkflowStepTemplate(
				integration.WorkflowStepTemplateID(workflowStepTemplateID2),
				integration.WorkflowStepTemplateJobAgentID(jobAgentID2),
				integration.WorkflowStepTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 20,
				}),
				integration.WorkflowStepTemplateName("Test Step 2"),
			),
		),
	)

	ctx := context.Background()

	workflowCreate := &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
	}
	engine.PushEvent(ctx, handler.WorkflowCreate, workflowCreate)

	workflows := engine.Workspace().Workflows().GetByTemplateID(workflowTemplateID)
	assert.Len(t, workflows, 1)
	workflowsSlice := make([]*oapi.Workflow, 0)
	for _, workflow := range workflows {
		workflowsSlice = append(workflowsSlice, workflow)
	}
	workflow := workflowsSlice[0]
	assert.NotNil(t, workflow)
	assert.Equal(t, workflowTemplateID, workflow.WorkflowTemplateId)

	workflowSteps := engine.Workspace().WorkflowSteps().GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowSteps, 2)
	assert.Equal(t, 0, workflowSteps[0].Index)
	assert.Equal(t, 1, workflowSteps[1].Index)

	step1jobs := engine.Workspace().Jobs().GetByWorkflowStepId(workflowSteps[0].Id)
	assert.Len(t, step1jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, step1jobs[0].Status)
	assert.Equal(t, workflowSteps[0].Id, step1jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgentID1, step1jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, step1jobs[0].JobAgentConfig)

	step2jobs := engine.Workspace().Jobs().GetByWorkflowStepId(workflowSteps[1].Id)
	assert.Len(t, step2jobs, 0)

	completedAt := time.Now()
	jobUpdateEvent := &oapi.JobUpdateEvent{
		Id: &step1jobs[0].Id,
		Job: oapi.Job{
			Id:          step1jobs[0].Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	step2jobs = engine.Workspace().Jobs().GetByWorkflowStepId(workflowSteps[1].Id)
	assert.Len(t, step2jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, step2jobs[0].Status)
	assert.Equal(t, workflowSteps[1].Id, step2jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgentID2, step2jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(20),
	}, step2jobs[0].JobAgentConfig)

	wfv, err := workflowmanager.NewWorkflowView(engine.Workspace().Store(), workflow.Id)
	assert.NoError(t, err)
	assert.NotNil(t, wfv)
	assert.False(t, wfv.IsComplete())

	completedAt2 := time.Now()
	jobUpdateEvent2 := &oapi.JobUpdateEvent{
		Id: &step2jobs[0].Id,
		Job: oapi.Job{
			Id:          step2jobs[0].Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt2,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent2)

	wfv, err = workflowmanager.NewWorkflowView(engine.Workspace().Store(), workflow.Id)
	assert.NoError(t, err)
	assert.NotNil(t, wfv)
	assert.True(t, wfv.IsComplete())
}

func TestEngine_Workflow_ConcurrentWorkflows(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowStepTemplateID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputName("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowStepTemplate(
				integration.WorkflowStepTemplateID(workflowStepTemplateID),
				integration.WorkflowStepTemplateJobAgentID(jobAgentID),
				integration.WorkflowStepTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowStepTemplateName("Test Step 1"),
			),
		),
	)

	ctx := context.Background()

	workflow1Create := &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
		Inputs: map[string]any{
			"input-1": "custom-1",
		},
	}
	engine.PushEvent(ctx, handler.WorkflowCreate, workflow1Create)

	workflow2Create := &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
		Inputs: map[string]any{
			"input-1": "custom-2",
		},
	}
	engine.PushEvent(ctx, handler.WorkflowCreate, workflow2Create)

	workflows := engine.Workspace().Workflows().GetByTemplateID(workflowTemplateID)
	assert.Len(t, workflows, 2)
	assert.Equal(t, 2, len(workflows))

	workflowsSlice := make([]*oapi.Workflow, 0)
	for _, workflow := range workflows {
		workflowsSlice = append(workflowsSlice, workflow)
	}

	var workflow1 *oapi.Workflow
	var workflow2 *oapi.Workflow

	for _, workflow := range workflowsSlice {
		if workflow.Inputs["input-1"] == "custom-1" {
			workflow1 = workflow
		} else {
			workflow2 = workflow
		}
	}

	workflow1Steps := engine.Workspace().WorkflowSteps().GetByWorkflowId(workflow1.Id)
	assert.Len(t, workflow1Steps, 1)
	assert.Equal(t, 0, workflow1Steps[0].Index)

	workflow2Steps := engine.Workspace().WorkflowSteps().GetByWorkflowId(workflow2.Id)
	assert.Len(t, workflow2Steps, 1)
	assert.Equal(t, 0, workflow2Steps[0].Index)

	workflow1Jobs := engine.Workspace().Jobs().GetByWorkflowStepId(workflow1Steps[0].Id)
	assert.Len(t, workflow1Jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, workflow1Jobs[0].Status)
	assert.Equal(t, workflow1Steps[0].Id, workflow1Jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgentID, workflow1Jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, workflow1Jobs[0].JobAgentConfig)

	completedAt1 := time.Now()
	jobUpdateEvent1 := &oapi.JobUpdateEvent{
		Id: &workflow1Jobs[0].Id,
		Job: oapi.Job{
			Id:          workflow1Jobs[0].Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt1,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent1)

	workflow2Jobs := engine.Workspace().Jobs().GetByWorkflowStepId(workflow2Steps[0].Id)
	assert.Len(t, workflow2Jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, workflow2Jobs[0].Status)
	assert.Equal(t, workflow2Steps[0].Id, workflow2Jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgentID, workflow2Jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, workflow2Jobs[0].JobAgentConfig)

	completedAt2 := time.Now()
	jobUpdateEvent2 := &oapi.JobUpdateEvent{
		Id: &workflow2Jobs[0].Id,
		Job: oapi.Job{
			Id:          workflow2Jobs[0].Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt2,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent2)

	wfv1, err := workflowmanager.NewWorkflowView(engine.Workspace().Store(), workflow1.Id)
	assert.NoError(t, err)
	assert.NotNil(t, wfv1)
	assert.True(t, wfv1.IsComplete())

	wfv2, err := workflowmanager.NewWorkflowView(engine.Workspace().Store(), workflow2.Id)
	assert.NoError(t, err)
	assert.NotNil(t, wfv2)
	assert.True(t, wfv2.IsComplete())
}
