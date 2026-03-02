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

func TestWorkflowManager_CreatesNewWorkflowRun(t *testing.T) {
	ctx := context.Background()
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     "test-input",
		Type:    oapi.String,
		Default: &[]string{"test-default"}[0],
	})

	jobAgent1ID := uuid.New().String()
	jobAgent1 := &oapi.JobAgent{
		Id:   jobAgent1ID,
		Name: "test-job-agent-1",
		Type: "test-runner",
		Config: map[string]any{
			"test-config": "test-value-1",
		},
	}
	store.JobAgents.Upsert(ctx, jobAgent1)

	workflowID := uuid.New().String()
	workflowJobTemplateID := uuid.New().String()
	workflow := &oapi.Workflow{
		Id:     workflowID,
		Name:   "test-workflow",
		Inputs: []oapi.WorkflowInput{stringInput},
		Jobs: []oapi.WorkflowJobTemplate{
			{
				Id:   workflowJobTemplateID,
				Name: "test-job",
				Ref:  jobAgent1ID,
				Config: map[string]any{
					"delaySeconds": 10,
				},
			},
		},
	}
	store.Workflows.Upsert(ctx, workflow)

	wfRun, err := manager.CreateWorkflowRun(ctx, workflowID, map[string]any{
		"test-input": "test-value",
	})

	workflowRun, ok := store.WorkflowRuns.Get(wfRun.Id)
	assert.True(t, ok)
	assert.NoError(t, err)
	assert.NotNil(t, workflowRun)
	assert.Equal(t, workflowID, workflowRun.WorkflowId)
	assert.Equal(t, map[string]any{
		"test-input": "test-value",
	}, workflowRun.Inputs)

	wfJobs := store.WorkflowJobs.GetByWorkflowRunId(workflowRun.Id)
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
		Key:     "test-input",
		Type:    oapi.String,
		Default: &[]string{"test-default"}[0],
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

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Name:   "test-workflow",
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
	store.Workflows.Upsert(ctx, workflow)

	wfRun, err := manager.CreateWorkflowRun(ctx, "test-workflow", map[string]any{
		"test-input": "test-value",
	})
	assert.NoError(t, err)
	assert.NotNil(t, wfRun)
	assert.Equal(t, "test-workflow", wfRun.WorkflowId)

	wfJobs := store.WorkflowJobs.GetByWorkflowRunId(wfRun.Id)
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

	workflow := &oapi.Workflow{
		Id:   "test-workflow",
		Name: "test-workflow",
		Jobs: []oapi.WorkflowJobTemplate{
			{Id: "test-job-1", Name: "test-job-1", Ref: "test-job-agent-1"},
			{Id: "test-job-2", Name: "test-job-2", Ref: "test-job-agent-2"},
		},
	}
	store.Workflows.Upsert(ctx, workflow)

	wfRun, _ := manager.CreateWorkflowRun(ctx, "test-workflow", nil)

	wfv, err := NewWorkflowRunView(store, wfRun.Id)
	assert.NoError(t, err)
	assert.False(t, wfv.IsComplete())

	wfJobs := store.WorkflowJobs.GetByWorkflowRunId(wfRun.Id)
	now := time.Now().UTC()

	job1 := store.Jobs.GetByWorkflowJobId(wfJobs[0].Id)[0]
	job1.CompletedAt = &now
	job1.Status = oapi.JobStatusSuccessful
	assert.NoError(t, store.Jobs.Upsert(ctx, job1))

	wfv, _ = NewWorkflowRunView(store, wfRun.Id)
	assert.False(t, wfv.IsComplete())

	job2 := store.Jobs.GetByWorkflowJobId(wfJobs[1].Id)[0]
	job2.CompletedAt = &now
	job2.Status = oapi.JobStatusSuccessful
	assert.NoError(t, store.Jobs.Upsert(ctx, job2))

	wfv, _ = NewWorkflowRunView(store, wfRun.Id)
	assert.True(t, wfv.IsComplete())
}

func TestCreateWorkflow_SkipsJobWhenIfEvaluatesToFalse(t *testing.T) {
	ctx := context.Background()
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	jobAgent := &oapi.JobAgent{
		Id:   "test-job-agent",
		Name: "test-job-agent",
		Type: "test-runner",
	}
	store.JobAgents.Upsert(ctx, jobAgent)

	ifTrue := "inputs.run_job == true"
	ifFalse := "inputs.run_job == false"

	workflow := &oapi.Workflow{
		Id:   "test-workflow",
		Name: "test-workflow",
		Jobs: []oapi.WorkflowJobTemplate{
			{Id: "always-job", Name: "always-job", Ref: "test-job-agent", Config: map[string]any{}},
			{Id: "true-job", Name: "true-job", Ref: "test-job-agent", Config: map[string]any{}, If: &ifTrue},
			{Id: "false-job", Name: "false-job", Ref: "test-job-agent", Config: map[string]any{}, If: &ifFalse},
		},
	}
	store.Workflows.Upsert(ctx, workflow)

	wfRun, err := manager.CreateWorkflowRun(ctx, "test-workflow", map[string]any{
		"run_job": true,
	})
	assert.NoError(t, err)
	assert.NotNil(t, wfRun)

	wfJobs := store.WorkflowJobs.GetByWorkflowRunId(wfRun.Id)
	assert.Len(t, wfJobs, 2, "should have 2 jobs: always-job and true-job, but not false-job")
}

func TestMaybeSetDefaultInputValues_SetsStringDefault(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     "string-input",
		Type:    oapi.String,
		Default: &[]string{"default-value"}[0],
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Inputs: []oapi.WorkflowInput{stringInput},
	}

	inputs := map[string]any{}
	manager.maybeSetDefaultInputValues(inputs, workflow)

	assert.Equal(t, "default-value", inputs["string-input"])
}

func TestMaybeSetDefaultInputValues_SetsNumberDefault(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var numberInput oapi.WorkflowInput
	_ = numberInput.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Key:     "number-input",
		Type:    oapi.Number,
		Default: &[]float32{42.0}[0],
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Inputs: []oapi.WorkflowInput{numberInput},
	}

	inputs := map[string]any{}
	manager.maybeSetDefaultInputValues(inputs, workflow)

	assert.Equal(t, float32(42.0), inputs["number-input"])
}

func TestMaybeSetDefaultInputValues_SetsBooleanDefault(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var booleanInput oapi.WorkflowInput
	_ = booleanInput.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Key:     "boolean-input",
		Type:    oapi.Boolean,
		Default: &[]bool{true}[0],
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Inputs: []oapi.WorkflowInput{booleanInput},
	}

	inputs := map[string]any{}
	manager.maybeSetDefaultInputValues(inputs, workflow)

	assert.Equal(t, true, inputs["boolean-input"])
}

func TestMaybeSetDefaultInputValues_SetsObjectDefault(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var objectInput oapi.WorkflowInput
	_ = objectInput.FromWorkflowObjectInput(oapi.WorkflowObjectInput{
		Key:     "object-input",
		Type:    oapi.Object,
		Default: &map[string]any{"key": "value"},
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Inputs: []oapi.WorkflowInput{objectInput},
	}

	inputs := map[string]any{}
	manager.maybeSetDefaultInputValues(inputs, workflow)
	assert.Equal(t, map[string]any{"key": "value"}, inputs["object-input"])
}

func TestMaybeSetDefaultInputValues_DoesNotOverwriteExistingValue(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     "string-input",
		Type:    oapi.String,
		Default: &[]string{"default-value"}[0],
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Inputs: []oapi.WorkflowInput{stringInput},
	}

	inputs := map[string]any{
		"string-input": "user-provided-value",
	}
	manager.maybeSetDefaultInputValues(inputs, workflow)

	assert.Equal(t, "user-provided-value", inputs["string-input"])
}

func TestMaybeSetDefaultInputValues_HandlesMultipleInputTypes(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     "string-input",
		Type:    oapi.String,
		Default: &[]string{"default-string"}[0],
	})

	var numberInput oapi.WorkflowInput
	_ = numberInput.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Key:     "number-input",
		Type:    oapi.Number,
		Default: &[]float32{123.0}[0],
	})

	var booleanInput oapi.WorkflowInput
	_ = booleanInput.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Key:     "boolean-input",
		Type:    oapi.Boolean,
		Default: &[]bool{false}[0],
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow-template",
		Inputs: []oapi.WorkflowInput{stringInput, numberInput, booleanInput},
	}

	inputs := map[string]any{}
	manager.maybeSetDefaultInputValues(inputs, workflow)

	assert.Equal(t, "default-string", inputs["string-input"])
	assert.Equal(t, float32(123.0), inputs["number-input"])
	assert.Equal(t, false, inputs["boolean-input"])
}

func TestMaybeSetDefaultInputValues_SkipsInputsWithoutDefault(t *testing.T) {
	store := store.New("test-workspace", statechange.NewChangeSet[any]())
	jobAgentRegistry := jobagents.NewRegistry(store, verification.NewManager(store))
	manager := NewWorkflowManager(store, jobAgentRegistry)

	var stringInput oapi.WorkflowInput
	_ = stringInput.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:  "string-input",
		Type: oapi.String,
		// No default
	})

	workflow := &oapi.Workflow{
		Id:     "test-workflow",
		Inputs: []oapi.WorkflowInput{stringInput},
	}

	inputs := map[string]any{}
	manager.maybeSetDefaultInputValues(inputs, workflow)

	_, exists := inputs["string-input"]
	assert.False(t, exists)
}
