package workflowmanager

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestWorkflowManager_CreatesNewWorkflow(t *testing.T) {
	ctx := context.Background()
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Name:    "test-input",
		Type:    oapi.String,
		Default: "test-default",
	})

	jobAgent1 := &oapi.JobAgent{
		Id:   "test-job-agent-1",
		Name: "test-job-agent-1",
		Type: "test-runner",
		Config: map[string]any{
			"test-config": "test-value-1",
		},
	}
	store.JobAgents.Upsert(ctx, jobAgent1)

	jobAgent2 := &oapi.JobAgent{
		Id:   "test-job-agent-2",
		Name: "test-job-agent-2",
		Type: "test-runner",
		Config: map[string]any{
			"test-config": "test-value-2",
		},
	}
	store.JobAgents.Upsert(ctx, jobAgent2)

	workflowTemplate := &oapi.WorkflowTemplate{
		Id:     "test-workflow-template",
		Name:   "test-workflow-template",
		Inputs: []oapi.WorkflowInput{stringInput},
		Steps: []oapi.WorkflowStepTemplate{
			{
				Id:   "test-step",
				Name: "test-step",
				JobAgent: oapi.WorkflowJobAgentConfig{
					Id: "test-job-agent-1",
					Config: map[string]any{
						"delaySeconds": 10,
					},
				},
			},
		},
	}
	store.WorkflowTemplates.Upsert(ctx, workflowTemplate)

	wf, err := manager.CreateWorkflow(ctx, "test-workflow-template", map[string]any{
		"test-input": "test-value",
	})

	workflow, ok := store.Workflows.Get(wf.Id)
	assert.True(t, ok)
	assert.NoError(t, err)
	assert.NotNil(t, workflow)
	assert.Equal(t, "test-workflow-template", workflow.WorkflowTemplateId)
	assert.Equal(t, map[string]any{
		"test-input": "test-value",
	}, workflow.Inputs)

	steps := store.WorkflowSteps.GetByWorkflowId(workflow.Id)
	assert.Len(t, steps, 1)
	assert.Equal(t, 0, steps[0].Index)

	jobs := store.Jobs.GetByWorkflowStepId(steps[0].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, steps[0].Id, jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgent1.Id, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"test-config":  "test-value-1",
		"delaySeconds": 10,
	}, jobs[0].JobAgentConfig)
}

func TestWorkflowManager_ContinuesWorkflowAfterStepComplete(t *testing.T) {
	ctx := context.Background()
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Name:    "test-input",
		Type:    oapi.String,
		Default: "test-default",
	})

	jobAgent1 := &oapi.JobAgent{
		Id:   "test-job-agent-1",
		Name: "test-job-agent-1",
		Type: "test-runner",
		Config: map[string]any{
			"test-config": "test-value-1",
		},
	}
	store.JobAgents.Upsert(ctx, jobAgent1)

	jobAgent2 := &oapi.JobAgent{
		Id:   "test-job-agent-2",
		Name: "test-job-agent-2",
		Type: "test-runner",
		Config: map[string]any{
			"test-config": "test-value-2",
		},
	}
	store.JobAgents.Upsert(ctx, jobAgent2)

	workflowTemplate := &oapi.WorkflowTemplate{
		Id:     "test-workflow-template",
		Name:   "test-workflow-template",
		Inputs: []oapi.WorkflowInput{stringInput},
		Steps: []oapi.WorkflowStepTemplate{
			{
				Id:   "test-step-1",
				Name: "test-step-1",
				JobAgent: oapi.WorkflowJobAgentConfig{
					Id: "test-job-agent-1",
					Config: map[string]any{
						"delaySeconds": 10,
					},
				},
			},
			{
				Id:   "test-step-2",
				Name: "test-step-2",
				JobAgent: oapi.WorkflowJobAgentConfig{
					Id: "test-job-agent-2",
					Config: map[string]any{
						"delaySeconds": 20,
					},
				},
			},
		},
	}
	store.WorkflowTemplates.Upsert(ctx, workflowTemplate)

	workflow := &oapi.Workflow{
		Id:                 "test-workflow",
		WorkflowTemplateId: "test-workflow-template",
		Inputs: map[string]any{
			"test-input": "test-value",
		},
	}
	store.Workflows.Upsert(ctx, workflow)

	workflowStep1 := &oapi.WorkflowStep{
		Id:         uuid.New().String(),
		WorkflowId: workflow.Id,
		Index:      0,
		JobAgent: &oapi.WorkflowJobAgentConfig{
			Id: "test-job-agent-1",
			Config: map[string]any{
				"delaySeconds": 10,
			},
		},
	}
	store.WorkflowSteps.Upsert(ctx, workflowStep1)

	job := &oapi.Job{
		Id:             uuid.New().String(),
		WorkflowStepId: workflowStep1.Id,
		JobAgentId:     "test-job-agent-1",
		JobAgentConfig: map[string]any{
			"test-config":  "test-value-1",
			"delaySeconds": 10,
		},
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	store.Jobs.Upsert(ctx, job)

	wfv, err := NewWorkflowView(store, workflow.Id)
	assert.NoError(t, err)
	assert.False(t, wfv.IsComplete())
	assert.Equal(t, 1, wfv.GetNextStep().Index)

	err = manager.ReconcileWorkflow(ctx, workflow)
	assert.NoError(t, err)

	workflowSteps := store.WorkflowSteps.GetByWorkflowId(workflow.Id)
	assert.Len(t, workflowSteps, 2)
	assert.Equal(t, 0, workflowSteps[0].Index)
	assert.Equal(t, 1, workflowSteps[1].Index)

	jobs := store.Jobs.GetByWorkflowStepId(workflowSteps[1].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, workflowSteps[1].Id, jobs[0].WorkflowStepId)
	assert.Equal(t, jobAgent2.Id, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"test-config":  "test-value-2",
		"delaySeconds": 20,
	}, jobs[0].JobAgentConfig)
}
