package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowTaskTemplates(store *Store) *WorkflowTaskTemplates {
	return &WorkflowTaskTemplates{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowTaskTemplates struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *WorkflowTaskTemplates) Items() map[string]*oapi.WorkflowTaskTemplate {
	return w.repo.WorkflowTaskTemplates.Items()
}

func (w *WorkflowTaskTemplates) Get(id string) (*oapi.WorkflowTaskTemplate, bool) {
	return w.repo.WorkflowTaskTemplates.Get(id)
}

func (w *WorkflowTaskTemplates) Upsert(ctx context.Context, id string, workflowTaskTemplate *oapi.WorkflowTaskTemplate) {
	w.repo.WorkflowTaskTemplates.Set(id, workflowTaskTemplate)
	w.store.changeset.RecordUpsert(workflowTaskTemplate)
}

func (w *WorkflowTaskTemplates) Remove(ctx context.Context, id string) {
	workflowTaskTemplate, ok := w.repo.WorkflowTaskTemplates.Get(id)
	if !ok || workflowTaskTemplate == nil {
		return
	}
	w.repo.WorkflowTaskTemplates.Remove(id)
	w.store.changeset.RecordDelete(workflowTaskTemplate)
}
