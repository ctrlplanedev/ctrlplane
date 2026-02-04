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
		Jobs: []oapi.WorkflowJobTemplate{
			{
				Id:   "test-job",
				Name: "test-job",
				Ref:  "test-job-agent-1",
				Config: map[string]any{
					"delaySeconds": 10,
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

	wfJobs := store.WorkflowJobs.GetByWorkflowId(workflow.Id)
	assert.Len(t, wfJobs, 1)
	assert.Equal(t, 0, wfJobs[0].Index)

	jobs := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)
	assert.Len(t, jobs, 1)
	job := jobs[0]
	assert.NotNil(t, job)
	assert.Equal(t, oapi.JobStatusPending, job.Status)
	assert.Equal(t, wfJobs[0].Id, job.WorkflowJobId)
	assert.Equal(t, jobAgent1.Id, job.JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"test-config":  "test-value-1",
		"delaySeconds": 10,
	}, job.JobAgentConfig)
}

func TestWorkflowManager_ContinuesWorkflowAfterJobComplete(t *testing.T) {
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
		Jobs: []oapi.WorkflowJobTemplate{
			{
				Id:   "test-job-1",
				Name: "test-job-1",
				Ref:  "test-job-agent-1",
				Config: map[string]any{
					"delaySeconds": 10,
				},
			},
			{
				Id:   "test-job-2",
				Name: "test-job-2",
				Ref:  "test-job-agent-2",
				Config: map[string]any{
					"delaySeconds": 20,
				},
			},
		},
	}
	store.WorkflowTemplates.Upsert(ctx, workflowTemplate)

	wf, err := manager.CreateWorkflow(ctx, "test-workflow-template", map[string]any{
		"test-input": "test-value",
	})
	assert.NoError(t, err)
	assert.NotNil(t, wf)
	assert.Equal(t, "test-workflow-template", wf.WorkflowTemplateId)
	assert.Equal(t, map[string]any{
		"test-input": "test-value",
	}, wf.Inputs)

	wfJobs := store.WorkflowJobs.GetByWorkflowId(wf.Id)
	assert.Len(t, wfJobs, 2)
	assert.Equal(t, 0, wfJobs[0].Index)
	assert.Equal(t, 1, wfJobs[1].Index)

	now := time.Now().UTC()
	job1 := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)[0]
	job1.CompletedAt = &now
	job1.Status = oapi.JobStatusSuccessful
	store.Jobs.Upsert(ctx, job1)

	wfv, err := NewWorkflowView(store, wf.Id)
	assert.NoError(t, err)
	assert.False(t, wfv.IsComplete())
	assert.Equal(t, 1, wfv.GetNextJob().Index)

	err = manager.ReconcileWorkflow(ctx, wf)
	assert.NoError(t, err)

	wfJobs = store.WorkflowJobs.GetByWorkflowId(wf.Id)
	assert.Len(t, wfJobs, 2)
	assert.Equal(t, 0, wfJobs[0].Index)
	assert.Equal(t, 1, wfJobs[1].Index)

	jobs := store.Jobs.GetByWorkflowJobId(wfJobs[1].Id)
	assert.Len(t, jobs, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs[0].Status)
	assert.Equal(t, wfJobs[1].Id, jobs[0].WorkflowJobId)
	assert.Equal(t, jobAgent2.Id, jobs[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"test-config":  "test-value-2",
		"delaySeconds": 20,
	}, jobs[0].JobAgentConfig)
}

func TestWorkflowManager_DoesNotContinueIfJobIsInProgress(t *testing.T) {
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
		Jobs: []oapi.WorkflowJobTemplate{
			{
				Id:   "test-job-1",
				Name: "test-job-1",
				Ref:  "test-job-agent-1",
				Config: map[string]any{
					"delaySeconds": 10,
				},
			},
			{
				Id:   "test-job-2",
				Name: "test-job-2",
				Ref:  "test-job-agent-2",
				Config: map[string]any{
					"delaySeconds": 20,
				},
			},
		},
	}
	store.WorkflowTemplates.Upsert(ctx, workflowTemplate)

	wf, err := manager.CreateWorkflow(ctx, "test-workflow-template", map[string]any{
		"test-input": "test-value",
	})
	assert.NoError(t, err)
	assert.NotNil(t, wf)
	assert.Equal(t, "test-workflow-template", wf.WorkflowTemplateId)
	assert.Equal(t, map[string]any{
		"test-input": "test-value",
	}, wf.Inputs)

	wfJobs := store.WorkflowJobs.GetByWorkflowId(wf.Id)
	assert.Len(t, wfJobs, 2)
	assert.Equal(t, 0, wfJobs[0].Index)
	assert.Equal(t, 1, wfJobs[1].Index)

	now := time.Now().UTC()
	job1 := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)[0]
	job1.CompletedAt = &now
	job1.Status = oapi.JobStatusInProgress
	store.Jobs.Upsert(ctx, job1)

	wfv, err := NewWorkflowView(store, wf.Id)
	assert.NoError(t, err)
	assert.False(t, wfv.IsComplete())
	assert.Nil(t, wfv.GetNextJob())
	assert.True(t, wfv.HasActiveJobs())

	wfJob0Jobs := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)
	assert.Len(t, wfJob0Jobs, 1)

	err = manager.ReconcileWorkflow(ctx, wf)
	assert.NoError(t, err)

	wfJobs = store.WorkflowJobs.GetByWorkflowId(wf.Id)
	assert.Len(t, wfJobs, 2)
	assert.Equal(t, 0, wfJobs[0].Index)
	assert.Equal(t, 1, wfJobs[1].Index)

	jobs := store.Jobs.GetByWorkflowJobId(wfJobs[1].Id)
	assert.Len(t, jobs, 0)
}
