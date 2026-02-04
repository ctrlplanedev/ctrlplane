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

func TestWorkflowManager_DispatchesAllJobsConcurrently(t *testing.T) {
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

	wfJobs := store.WorkflowJobs.GetByWorkflowId(wf.Id)
	assert.Len(t, wfJobs, 2)
	assert.Equal(t, 0, wfJobs[0].Index)
	assert.Equal(t, 1, wfJobs[1].Index)

	jobs1 := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)
	assert.Len(t, jobs1, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs1[0].Status)
	assert.Equal(t, jobAgent1.Id, jobs1[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"test-config":  "test-value-1",
		"delaySeconds": 10,
	}, jobs1[0].JobAgentConfig)

	jobs2 := store.Jobs.GetByWorkflowJobId(wfJobs[1].Id)
	assert.Len(t, jobs2, 1)
	assert.Equal(t, oapi.JobStatusPending, jobs2[0].Status)
	assert.Equal(t, jobAgent2.Id, jobs2[0].JobAgentId)
	assert.Equal(t, oapi.JobAgentConfig{
		"test-config":  "test-value-2",
		"delaySeconds": 20,
	}, jobs2[0].JobAgentConfig)
}

func TestWorkflowView_IsComplete(t *testing.T) {
	ctx := context.Background()
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	jobAgent1 := &oapi.JobAgent{
		Id:   "test-job-agent-1",
		Name: "test-job-agent-1",
		Type: "test-runner",
	}
	store.JobAgents.Upsert(ctx, jobAgent1)

	jobAgent2 := &oapi.JobAgent{
		Id:   "test-job-agent-2",
		Name: "test-job-agent-2",
		Type: "test-runner",
	}
	store.JobAgents.Upsert(ctx, jobAgent2)

	workflowTemplate := &oapi.WorkflowTemplate{
		Id:   "test-workflow-template",
		Name: "test-workflow-template",
		Jobs: []oapi.WorkflowJobTemplate{
			{Id: "test-job-1", Name: "test-job-1", Ref: "test-job-agent-1"},
			{Id: "test-job-2", Name: "test-job-2", Ref: "test-job-agent-2"},
		},
	}
	store.WorkflowTemplates.Upsert(ctx, workflowTemplate)

	wf, _ := manager.CreateWorkflow(ctx, "test-workflow-template", nil)

	wfv, err := NewWorkflowView(store, wf.Id)
	assert.NoError(t, err)
	assert.False(t, wfv.IsComplete())

	wfJobs := store.WorkflowJobs.GetByWorkflowId(wf.Id)
	now := time.Now().UTC()

	job1 := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)[0]
	job1.CompletedAt = &now
	job1.Status = oapi.JobStatusSuccessful
	store.Jobs.Upsert(ctx, job1)

	wfv, _ = NewWorkflowView(store, wf.Id)
	assert.False(t, wfv.IsComplete())

	job2 := store.Jobs.GetByWorkflowJobId(wfJobs[1].Id)[0]
	job2.CompletedAt = &now
	job2.Status = oapi.JobStatusSuccessful
	store.Jobs.Upsert(ctx, job2)

	wfv, _ = NewWorkflowView(store, wf.Id)
	assert.True(t, wfv.IsComplete())
}
