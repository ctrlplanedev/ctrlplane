package workflowmanager

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type ActionTrigger string

const (
	ActionTriggerJobSuccess ActionTrigger = "job.success"
)

type WorkflowAction interface {
	Name() string
	Execute(ctx context.Context, trigger ActionTrigger, job *oapi.Job) error
}

type WorkflowActionOrchestrator struct {
	store   *store.Store
	actions []WorkflowAction
}

func NewWorkflowActionOrchestrator(store *store.Store) *WorkflowActionOrchestrator {
	return &WorkflowActionOrchestrator{
		store:   store,
		actions: make([]WorkflowAction, 0),
	}
}

func (w *WorkflowActionOrchestrator) RegisterAction(action WorkflowAction) *WorkflowActionOrchestrator {
	w.actions = append(w.actions, action)
	return w
}

func (w *WorkflowActionOrchestrator) OnJobSuccess(ctx context.Context, job *oapi.Job) error {
	for _, action := range w.actions {
		if err := action.Execute(ctx, ActionTriggerJobSuccess, job); err != nil {
			return err
		}
	}
	return nil
}
