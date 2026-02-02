package workflowmanager

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type WorkflowManagerAction struct {
	store   *store.Store
	manager *Manager
}

func NewWorkflowManagerAction(store *store.Store, manager *Manager) *WorkflowManagerAction {
	return &WorkflowManagerAction{
		store:   store,
		manager: manager,
	}
}

func (w *WorkflowManagerAction) Name() string {
	return "workflowmanager"
}

func (w *WorkflowManagerAction) Execute(ctx context.Context, trigger ActionTrigger, job *oapi.Job) error {
	if trigger != ActionTriggerJobSuccess {
		return nil
	}

	workflowStep, ok := w.store.WorkflowSteps.Get(job.WorkflowStepId)
	if !ok {
		return nil
	}

	workflow, ok := w.store.Workflows.Get(workflowStep.WorkflowId)
	if !ok {
		return fmt.Errorf("workflow %s not found for step %s", workflowStep.WorkflowId, workflowStep.Id)
	}

	return w.manager.ReconcileWorkflow(ctx, workflow)
}
