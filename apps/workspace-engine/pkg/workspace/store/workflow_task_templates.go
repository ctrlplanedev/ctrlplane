package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowStepTemplates(store *Store) *WorkflowStepTemplates {
	return &WorkflowStepTemplates{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowStepTemplates struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *WorkflowStepTemplates) Items() map[string]*oapi.WorkflowStepTemplate {
	return w.repo.WorkflowStepTemplates.Items()
}

func (w *WorkflowStepTemplates) Get(id string) (*oapi.WorkflowStepTemplate, bool) {
	return w.repo.WorkflowStepTemplates.Get(id)
}

func (w *WorkflowStepTemplates) Upsert(ctx context.Context, workflowStepTemplate *oapi.WorkflowStepTemplate) {
	w.repo.WorkflowStepTemplates.Set(workflowStepTemplate.Id, workflowStepTemplate)
	w.store.changeset.RecordUpsert(workflowStepTemplate)
}

func (w *WorkflowStepTemplates) Remove(ctx context.Context, id string) {
	workflowStepTemplate, ok := w.repo.WorkflowStepTemplates.Get(id)
	if !ok || workflowStepTemplate == nil {
		return
	}
	w.repo.WorkflowStepTemplates.Remove(id)
	w.store.changeset.RecordDelete(workflowStepTemplate)
}
