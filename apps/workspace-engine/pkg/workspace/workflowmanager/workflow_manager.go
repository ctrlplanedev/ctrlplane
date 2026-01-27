package workflowmanager

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type WorkflowManager struct {
	store *store.Store
}

func NewWorkflowManager(store *store.Store) *WorkflowManager {
	return &WorkflowManager{
		store: store,
	}
}

// createWorkflow creates and stores a new workflow with inputs
func (m *WorkflowManager) createWorkflow(ctx context.Context, workflowTemplate *oapi.WorkflowTemplate, inputs map[string]interface{}) (*oapi.Workflow, error) {
	return nil, nil
}

// getNextStepTemplate gets the next step template to execute based on the current workflow step
// this function will take into account current step status and dependencies
func (m *WorkflowManager) getNextStepTemplate(ctx context.Context, workflow *oapi.Workflow) (*oapi.WorkflowStepTemplate, error) {
	return nil, nil
}

// createWorkflowStep creates and stores a new workflow step
// it will template the config of the step template with the inputs of the workflow
func (m *WorkflowManager) createWorkflowStep(ctx context.Context, workflow *oapi.Workflow, stepTemplate *oapi.WorkflowStepTemplate) (*oapi.WorkflowStep, error) {
	return nil, nil
}

// dispatchJobForStep dispatches a job for the given step
func (m *WorkflowManager) dispatchJobForStep(ctx context.Context, workflow *oapi.Workflow, step *oapi.WorkflowStep) error {
	return nil
}

// CreateWorkflow creates and runs a new workflow
func (m *WorkflowManager) CreateWorkflow(ctx context.Context, workflowTemplate *oapi.WorkflowTemplate, inputs map[string]interface{}) error {
	workflow, err := m.createWorkflow(ctx, workflowTemplate, inputs)
	if err != nil {
		return err
	}

	nextStepTemplate, err := m.getNextStepTemplate(ctx, workflow)
	if err != nil {
		return err
	}

	step, err := m.createWorkflowStep(ctx, workflow, nextStepTemplate)
	if err != nil {
		return err
	}

	return m.dispatchJobForStep(ctx, workflow, step)
}

// ContinueWorkflow continues a workflow from the given step
func (m *WorkflowManager) ContinueWorkflow(ctx context.Context, workflow *oapi.Workflow) error {
	nextStepTemplate, err := m.getNextStepTemplate(ctx, workflow)
	if err != nil {
		return err
	}

	step, err := m.createWorkflowStep(ctx, workflow, nextStepTemplate)
	if err != nil {
		return err
	}

	return m.dispatchJobForStep(ctx, workflow, step)
}
