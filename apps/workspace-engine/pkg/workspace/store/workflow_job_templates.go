package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowJobTemplates(store *Store) *WorkflowJobTemplates {
	return &WorkflowJobTemplates{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowJobTemplates struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *WorkflowJobTemplates) Items() map[string]*oapi.WorkflowJobTemplate {
	return w.repo.WorkflowJobTemplates.Items()
}

func (w *WorkflowJobTemplates) Get(id string) (*oapi.WorkflowJobTemplate, bool) {
	return w.repo.WorkflowJobTemplates.Get(id)
}

func (w *WorkflowJobTemplates) Upsert(ctx context.Context, workflowJobTemplate *oapi.WorkflowJobTemplate) {
	w.repo.WorkflowJobTemplates.Set(workflowJobTemplate.Id, workflowJobTemplate)
	w.store.changeset.RecordUpsert(workflowJobTemplate)
}

func (w *WorkflowJobTemplates) Remove(ctx context.Context, id string) {
	workflowJobTemplate, ok := w.repo.WorkflowJobTemplates.Get(id)
	if !ok || workflowJobTemplate == nil {
		return
	}
	w.repo.WorkflowJobTemplates.Remove(id)
	w.store.changeset.RecordDelete(workflowJobTemplate)
}
