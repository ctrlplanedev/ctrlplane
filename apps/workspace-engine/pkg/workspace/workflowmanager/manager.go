package workflowmanager

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type Manager struct {
	store *store.Store
}

func NewWorkflowManager(store *store.Store) *Manager {
	return &Manager{
		store: store,
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
	return workflow, nil
}

// dispatchJobForStep dispatches a job for the given step
func (m *Manager) dispatchStep(ctx context.Context, workflow *oapi.Workflow, step *oapi.WorkflowStep) error {
	// job := &oapi.Job{
	// 	Id:             uuid.New().String(),
	// 	WorkflowStepId: step.Id,
	// 	JobAgentId:     step.JobAgent.Id,
	// 	JobAgentConfig: step.JobAgent.Config,
	// }
	return errors.New("not implemented")
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
	if wfv.HasPendingJobs() {
		return nil
	}

	nextStep := wfv.GetNextStep()
	if nextStep == nil {
		return nil
	}

	return m.dispatchStep(ctx, workflow, nextStep)
}
