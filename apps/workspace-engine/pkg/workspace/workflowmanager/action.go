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

	workflowJob, ok := w.store.WorkflowJobs.Get(job.WorkflowJobId)
	if !ok {
		return nil
	}

	workflow, ok := w.store.Workflows.Get(workflowJob.WorkflowId)
	if !ok {
		return fmt.Errorf("workflow %s not found for job %s", workflowJob.WorkflowId, workflowJob.Id)
	}

	return w.manager.ReconcileWorkflow(ctx, workflow)
}
