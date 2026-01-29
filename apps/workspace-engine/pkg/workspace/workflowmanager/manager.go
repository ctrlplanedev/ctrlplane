package workflowmanager

import (
	"context"
	"fmt"
	"maps"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

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

func (w *Manager) CreateWorkflow(ctx context.Context, workflowTemplateId string, inputs map[string]any) (*oapi.Workflow, error) {
	workflowTemplate, ok := w.store.WorkflowTemplates.Get(workflowTemplateId)
	if !ok {
		return nil, fmt.Errorf("workflow template %s not found", workflowTemplateId)
	}

	workflow := &oapi.Workflow{
		Id:                 uuid.New().String(),
		WorkflowTemplateId: workflowTemplateId,
		Inputs:             maps.Clone(inputs),
	}

	for idx, stepTemplate := range workflowTemplate.Steps {
		step := &oapi.WorkflowStep{
			Id:         uuid.New().String(),
			WorkflowId: workflow.Id,
			Index:      idx,
			JobAgent: &oapi.WorkflowJobAgentConfig{
				Id:     stepTemplate.JobAgent.Id,
				Config: maps.Clone(stepTemplate.JobAgent.Config),
			},
		}
		w.store.WorkflowSteps.Upsert(ctx, step)
	}

	w.store.Workflows.Upsert(ctx, workflow)

	w.ReconcileWorkflow(ctx, workflow)
	return workflow, nil
}

// dispatchJobForStep dispatches a job for the given step
func (m *Manager) dispatchStep(ctx context.Context, step *oapi.WorkflowStep) error {
	jobAgent, ok := m.store.JobAgents.Get(step.JobAgent.Id)
	if !ok {
		return fmt.Errorf("job agent %s not found", step.JobAgent.Id)
	}

	mergedConfig, err := mergeJobAgentConfig(
		jobAgent.Config,
		step.JobAgent.Config,
	)
	if err != nil {
		return fmt.Errorf("failed to merge job agent config: %w", err)
	}

	job := &oapi.Job{
		Id:             uuid.New().String(),
		WorkflowStepId: step.Id,
		JobAgentId:     step.JobAgent.Id,
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

// ReconcileWorkflow reconciles a workflow, advancing to the next step if ready.
func (m *Manager) ReconcileWorkflow(ctx context.Context, workflow *oapi.Workflow) error {
	wfv, err := NewWorkflowView(m.store, workflow.Id)
	if err != nil {
		return fmt.Errorf("failed to create workflow view: %w", err)
	}

	if wfv.IsComplete() {
		return nil
	}
	if wfv.HasActiveJobs() {
		return nil
	}

	nextStep := wfv.GetNextStep()
	if nextStep == nil {
		return nil
	}

	return m.dispatchStep(ctx, nextStep)
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
