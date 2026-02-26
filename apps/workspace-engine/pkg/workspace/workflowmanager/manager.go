package workflowmanager

import (
	"context"
	"fmt"
	"maps"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/jobs"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

var workflowCelEnv, _ = celutil.NewEnvBuilder().
	WithMapVariable("inputs").
	BuildCached(24 * time.Hour)

type Manager struct {
	store            *store.Store
	jobAgentRegistry *jobagents.Registry
	factory          *jobs.Factory
}

func NewWorkflowManager(store *store.Store, jobAgentRegistry *jobagents.Registry) *Manager {
	return &Manager{
		store:            store,
		jobAgentRegistry: jobAgentRegistry,
		factory:          jobs.NewFactory(store),
	}
}

func (m *Manager) maybeSetDefaultInputValues(inputs map[string]any, workflow *oapi.Workflow) {
	for _, input := range workflow.Inputs {
		if stringInput, err := input.AsWorkflowStringInput(); err == nil && stringInput.Type == oapi.String {
			if stringInput.Default != nil {
				if _, ok := inputs[stringInput.Key]; !ok {
					inputs[stringInput.Key] = *stringInput.Default
				}
			}
			continue
		}

		if numberInput, err := input.AsWorkflowNumberInput(); err == nil && numberInput.Type == oapi.Number {
			if numberInput.Default != nil {
				if _, ok := inputs[numberInput.Key]; !ok {
					inputs[numberInput.Key] = *numberInput.Default
				}
			}
			continue
		}

		if booleanInput, err := input.AsWorkflowBooleanInput(); err == nil && booleanInput.Type == oapi.Boolean {
			if booleanInput.Default != nil {
				if _, ok := inputs[booleanInput.Key]; !ok {
					inputs[booleanInput.Key] = *booleanInput.Default
				}
			}
		}

		if objectInput, err := input.AsWorkflowObjectInput(); err == nil && objectInput.Type == oapi.Object {
			if objectInput.Default != nil {
				if _, ok := inputs[objectInput.Key]; !ok {
					inputs[objectInput.Key] = *objectInput.Default
				}
			}
		}
	}
}

func (m *Manager) evaluateJobTemplateIf(jobTemplate oapi.WorkflowJobTemplate, inputs map[string]any) (bool, error) {
	prg, err := workflowCelEnv.Compile(*jobTemplate.If)
	if err != nil {
		return false, fmt.Errorf("failed to compile CEL expression for job %q: %w", jobTemplate.Name, err)
	}
	result, err := celutil.EvalBool(prg, map[string]any{"inputs": inputs})
	if err != nil {
		return false, fmt.Errorf("failed to evaluate CEL expression for job %q: %w", jobTemplate.Name, err)
	}
	return result, nil
}

func (m *Manager) CreateWorkflowRun(ctx context.Context, workflowId string, inputs map[string]any) (*oapi.WorkflowRun, error) {
	workflow, ok := m.store.Workflows.Get(workflowId)
	if !ok {
		return nil, fmt.Errorf("workflow %s not found", workflowId)
	}

	m.maybeSetDefaultInputValues(inputs, workflow)

	workflowRun := &oapi.WorkflowRun{
		Id:         uuid.New().String(),
		WorkflowId: workflowId,
		Inputs:     maps.Clone(inputs),
	}

	m.store.WorkflowRuns.Upsert(ctx, workflowRun)

	workflowJobs := make([]*oapi.WorkflowJob, 0, len(workflow.Jobs))
	for idx, jobTemplate := range workflow.Jobs {
		if jobTemplate.If != nil {
			shouldRun, err := m.evaluateJobTemplateIf(jobTemplate, inputs)
			if err != nil {
				return nil, fmt.Errorf("failed to evaluate CEL expression for job %q: %w", jobTemplate.Name, err)
			}
			if !shouldRun {
				continue
			}
		}

		wfJob := &oapi.WorkflowJob{
			Id:            uuid.New().String(),
			WorkflowRunId: workflowRun.Id,
			Index:         idx,
			Ref:           jobTemplate.Ref,
			Config:        maps.Clone(jobTemplate.Config),
		}
		m.store.WorkflowJobs.Upsert(ctx, wfJob)
		workflowJobs = append(workflowJobs, wfJob)
	}

	m.store.WorkflowRuns.Upsert(ctx, workflowRun)

	for _, wfJob := range workflowJobs {
		job, err := m.factory.CreateJobForWorkflowJob(ctx, wfJob)
		if err != nil {
			return nil, fmt.Errorf("failed to create job for workflow job %q: %w", wfJob.Id, err)
		}
		m.store.Jobs.Upsert(ctx, job)
		if err := m.jobAgentRegistry.Dispatch(ctx, job); err != nil {
			return nil, fmt.Errorf("failed to dispatch job: %w", err)
		}
	}

	return workflowRun, nil
}
