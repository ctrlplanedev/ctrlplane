package workflowmanager

import (
	"context"
	"fmt"
	"maps"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

var workflowCelEnv, _ = celutil.NewEnvBuilder().
	WithMapVariable("inputs").
	BuildCached(24 * time.Hour)

type Manager struct {
	store            *store.Store
	jobAgentRegistry *jobagents.Registry
}

func NewWorkflowManager(store *store.Store, jobAgentRegistry *jobagents.Registry) *Manager {
	return &Manager{
		store:            store,
		jobAgentRegistry: jobAgentRegistry,
	}
}

func (m *Manager) maybeSetDefaultInputValues(inputs map[string]any, workflowTemplate *oapi.WorkflowTemplate) {
	for _, input := range workflowTemplate.Inputs {
		if stringInput, err := input.AsWorkflowStringInput(); err == nil && stringInput.Type == oapi.String {
			if stringInput.Default != nil {
				if _, ok := inputs[stringInput.Name]; !ok {
					inputs[stringInput.Name] = *stringInput.Default
				}
			}
			continue
		}

		if numberInput, err := input.AsWorkflowNumberInput(); err == nil && numberInput.Type == oapi.Number {
			if numberInput.Default != nil {
				if _, ok := inputs[numberInput.Name]; !ok {
					inputs[numberInput.Name] = *numberInput.Default
				}
			}
			continue
		}

		if booleanInput, err := input.AsWorkflowBooleanInput(); err == nil && booleanInput.Type == oapi.Boolean {
			if booleanInput.Default != nil {
				if _, ok := inputs[booleanInput.Name]; !ok {
					inputs[booleanInput.Name] = *booleanInput.Default
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

func (m *Manager) CreateWorkflow(ctx context.Context, workflowTemplateId string, inputs map[string]any) (*oapi.Workflow, error) {
	workflowTemplate, ok := m.store.WorkflowTemplates.Get(workflowTemplateId)
	if !ok {
		return nil, fmt.Errorf("workflow template %s not found", workflowTemplateId)
	}

	m.maybeSetDefaultInputValues(inputs, workflowTemplate)

	workflow := &oapi.Workflow{
		Id:                 uuid.New().String(),
		WorkflowTemplateId: workflowTemplateId,
		Inputs:             maps.Clone(inputs),
	}

	workflowJobs := make([]*oapi.WorkflowJob, 0, len(workflowTemplate.Jobs))
	for idx, jobTemplate := range workflowTemplate.Jobs {
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
			Id:         uuid.New().String(),
			WorkflowId: workflow.Id,
			Index:      idx,
			Ref:        jobTemplate.Ref,
			Config:     maps.Clone(jobTemplate.Config),
		}
		m.store.WorkflowJobs.Upsert(ctx, wfJob)
		workflowJobs = append(workflowJobs, wfJob)
	}

	m.store.Workflows.Upsert(ctx, workflow)

	for _, wfJob := range workflowJobs {
		if err := m.dispatchJob(ctx, wfJob); err != nil {
			return workflow, err
		}
	}

	return workflow, nil
}

func (m *Manager) dispatchJob(ctx context.Context, wfJob *oapi.WorkflowJob) error {
	jobAgent, ok := m.store.JobAgents.Get(wfJob.Ref)
	if !ok {
		return fmt.Errorf("job agent %s not found", wfJob.Ref)
	}

	mergedConfig, err := mergeJobAgentConfig(jobAgent.Config, wfJob.Config)
	if err != nil {
		return fmt.Errorf("failed to merge job agent config: %w", err)
	}

	job := &oapi.Job{
		Id:             uuid.New().String(),
		WorkflowJobId:  wfJob.Id,
		JobAgentId:     wfJob.Ref,
		JobAgentConfig: mergedConfig,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       make(map[string]string),
		Status:         oapi.JobStatusPending,
	}

	m.store.Jobs.Upsert(ctx, job)
	if err := m.jobAgentRegistry.Dispatch(ctx, job); err != nil {
		return fmt.Errorf("failed to dispatch job: %w", err)
	}

	return nil
}

func mergeJobAgentConfig(configs ...oapi.JobAgentConfig) (oapi.JobAgentConfig, error) {
	mergedConfig := make(map[string]any)
	for _, config := range configs {
		deepMerge(mergedConfig, config)
	}
	return mergedConfig, nil
}

func deepMerge(dst, src map[string]any) {
	for k, v := range src {
		if sm, ok := v.(map[string]any); ok {
			if dm, ok := dst[k].(map[string]any); ok {
				deepMerge(dm, sm)
				continue
			}
		}
		dst[k] = v
	}
}
