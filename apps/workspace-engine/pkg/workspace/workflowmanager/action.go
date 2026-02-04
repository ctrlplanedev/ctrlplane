package workflowmanager

import (
	"context"
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
	return nil
}
