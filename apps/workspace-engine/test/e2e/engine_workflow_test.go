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
	workflowJobTemplateID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputKey("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowJobTemplateName("Test Job 1"),
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

	workflowJobs := engine.Workspace().WorkflowJobs().GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowJobs, 1)
	assert.Equal(t, 0, workflowJobs[0].Index)

	jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflowJobs[0].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, workflowJobs[0].Id, jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgentID, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, jobs[0].JobAgentConfig)
}

func TestEngine_Workflow_MultipleInputs(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowJobTemplateID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputKey("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowNumberInput(
				integration.WorkflowNumberInputKey("input-2"),
				integration.WorkflowNumberInputDefault(2),
			),
			integration.WithWorkflowBooleanInput(
				integration.WorkflowBooleanInputKey("input-3"),
				integration.WorkflowBooleanInputDefault(true),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowJobTemplateName("Test Job 1"),
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

	workflowJobs := engine.Workspace().WorkflowJobs().GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowJobs, 1)
	assert.Equal(t, 0, workflowJobs[0].Index)

	jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflowJobs[0].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, workflowJobs[0].Id, jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgentID, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, jobs[0].JobAgentConfig)
}

func TestEngine_Workflow_MultipleJobsConcurrent(t *testing.T) {
	jobAgentID1 := uuid.New().String()
	jobAgentID2 := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowJobTemplateID1 := uuid.New().String()
	workflowJobTemplateID2 := uuid.New().String()

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
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID1),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID1),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowJobTemplateName("Test Job 1"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID2),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID2),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 20,
				}),
				integration.WorkflowJobTemplateName("Test Job 2"),
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

	workflowJobs := engine.Workspace().WorkflowJobs().GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowJobs, 2)
	assert.Equal(t, 0, workflowJobs[0].Index)
	assert.Equal(t, 1, workflowJobs[1].Index)

	wfJob1jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflowJobs[0].Id)
	assert.Len(t, wfJob1jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, wfJob1jobs[0].Status)
	assert.Equal(t, workflowJobs[0].Id, wfJob1jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgentID1, wfJob1jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, wfJob1jobs[0].JobAgentConfig)

	wfJob2jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflowJobs[1].Id)
	assert.Len(t, wfJob2jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, wfJob2jobs[0].Status)
	assert.Equal(t, workflowJobs[1].Id, wfJob2jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgentID2, wfJob2jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(20),
	}, wfJob2jobs[0].JobAgentConfig)

	wfv, err := workflowmanager.NewWorkflowView(engine.Workspace().Store(), workflow.Id)
	assert.NoError(t, err)
	assert.NotNil(t, wfv)
	assert.False(t, wfv.IsComplete())

	completedAt := time.Now()
	jobUpdateEvent := &oapi.JobUpdateEvent{
		Id: &wfJob1jobs[0].Id,
		Job: oapi.Job{
			Id:          wfJob1jobs[0].Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	wfv, err = workflowmanager.NewWorkflowView(engine.Workspace().Store(), workflow.Id)
	assert.NoError(t, err)
	assert.False(t, wfv.IsComplete())

	completedAt2 := time.Now()
	jobUpdateEvent2 := &oapi.JobUpdateEvent{
		Id: &wfJob2jobs[0].Id,
		Job: oapi.Job{
			Id:          wfJob2jobs[0].Id,
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
	workflowJobTemplateID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputKey("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowJobTemplateName("Test Job 1"),
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

	workflow1WorkflowJobs := engine.Workspace().WorkflowJobs().GetByWorkflowId(workflow1.Id)
	assert.Len(t, workflow1WorkflowJobs, 1)
	assert.Equal(t, 0, workflow1WorkflowJobs[0].Index)

	workflow2WorkflowJobs := engine.Workspace().WorkflowJobs().GetByWorkflowId(workflow2.Id)
	assert.Len(t, workflow2WorkflowJobs, 1)
	assert.Equal(t, 0, workflow2WorkflowJobs[0].Index)

	workflowJob1Jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflow1WorkflowJobs[0].Id)
	assert.Len(t, workflowJob1Jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, workflowJob1Jobs[0].Status)
	assert.Equal(t, workflow1WorkflowJobs[0].Id, workflowJob1Jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgentID, workflowJob1Jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, workflowJob1Jobs[0].JobAgentConfig)

	completedAt1 := time.Now()
	jobUpdateEvent1 := &oapi.JobUpdateEvent{
		Id: &workflowJob1Jobs[0].Id,
		Job: oapi.Job{
			Id:          workflowJob1Jobs[0].Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt1,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent1)

	workflowJob2Jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflow2WorkflowJobs[0].Id)
	assert.Len(t, workflowJob2Jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, workflowJob2Jobs[0].Status)
	assert.Equal(t, workflow2WorkflowJobs[0].Id, workflowJob2Jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgentID, workflowJob2Jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"delaySeconds": float64(10),
	}, workflowJob2Jobs[0].JobAgentConfig)

	completedAt2 := time.Now()
	jobUpdateEvent2 := &oapi.JobUpdateEvent{
		Id: &workflowJob2Jobs[0].Id,
		Job: oapi.Job{
			Id:          workflowJob2Jobs[0].Id,
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

func TestEngine_Workflow_DeleteTemplateCascade(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowTemplateID := uuid.New().String()
	workflowJobTemplateID1 := uuid.New().String()
	workflowJobTemplateID2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithWorkflowTemplate(
			integration.WorkflowTemplateID(workflowTemplateID),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputKey("input-1"),
				integration.WorkflowStringInputDefault("default-1"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID1),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 10,
				}),
				integration.WorkflowJobTemplateName("Test Job 1"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateID(workflowJobTemplateID2),
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"delaySeconds": 20,
				}),
				integration.WorkflowJobTemplateName("Test Job 2"),
			),
		),
	)

	ctx := context.Background()

	engine.PushEvent(ctx, handler.WorkflowCreate, &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
		Inputs:             map[string]any{"input-1": "value-1"},
	})
	engine.PushEvent(ctx, handler.WorkflowCreate, &oapi.Workflow{
		WorkflowTemplateId: workflowTemplateID,
		Inputs:             map[string]any{"input-1": "value-2"},
	})

	workflows := engine.Workspace().Workflows().GetByTemplateID(workflowTemplateID)
	assert.Len(t, workflows, 2)

	allWorkflowJobIDs := make([]string, 0)
	allJobIDs := make([]string, 0)
	for _, wf := range workflows {
		wfJobs := engine.Workspace().WorkflowJobs().GetByWorkflowId(wf.Id)
		assert.Len(t, wfJobs, 2, "each workflow should have 2 workflow jobs")
		for _, wfJob := range wfJobs {
			allWorkflowJobIDs = append(allWorkflowJobIDs, wfJob.Id)
			jobs := engine.Workspace().Jobs().GetByWorkflowJobId(wfJob.Id)
			assert.Len(t, jobs, 1, "each workflow job should have 1 job")
			allJobIDs = append(allJobIDs, jobs[0].Id)
		}
	}
	assert.Len(t, allWorkflowJobIDs, 4, "should have 4 workflow jobs total")
	assert.Len(t, allJobIDs, 4, "should have 4 jobs total")

	workflowTemplate, ok := engine.Workspace().WorkflowTemplates().Get(workflowTemplateID)
	assert.True(t, ok)
	engine.PushEvent(ctx, handler.WorkflowTemplateDelete, workflowTemplate)

	_, ok = engine.Workspace().WorkflowTemplates().Get(workflowTemplateID)
	assert.False(t, ok, "workflow template should be removed")

	remainingWorkflows := engine.Workspace().Workflows().GetByTemplateID(workflowTemplateID)
	assert.Empty(t, remainingWorkflows, "all workflows should be removed")

	for _, wfJobID := range allWorkflowJobIDs {
		_, ok := engine.Workspace().WorkflowJobs().Get(wfJobID)
		assert.False(t, ok, "workflow job %s should be removed", wfJobID)
	}

	for _, jobID := range allJobIDs {
		_, ok := engine.Workspace().Jobs().Get(jobID)
		assert.False(t, ok, "job %s should be removed", jobID)
	}
}
