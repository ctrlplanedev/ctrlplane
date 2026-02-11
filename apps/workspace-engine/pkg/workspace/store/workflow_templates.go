package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowTemplates(store *Store) *WorkflowTemplates {
	return &WorkflowTemplates{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowTemplates struct {
	repo  *repository.Repo
	store *Store
}

func (w *WorkflowTemplates) Items() map[string]*oapi.WorkflowTemplate {
	return w.repo.WorkflowTemplates.Items()
}

func (w *WorkflowTemplates) Get(id string) (*oapi.WorkflowTemplate, bool) {
	return w.repo.WorkflowTemplates.Get(id)
}

func (w *WorkflowTemplates) Upsert(ctx context.Context, workflowTemplate *oapi.WorkflowTemplate) {
	w.repo.WorkflowTemplates.Set(workflowTemplate.Id, workflowTemplate)
	w.store.changeset.RecordUpsert(workflowTemplate)
}

func (w *WorkflowTemplates) Remove(ctx context.Context, id string) {
	workflowTemplate, ok := w.repo.WorkflowTemplates.Get(id)
	if !ok || workflowTemplate == nil {
		return
	}
	w.repo.WorkflowTemplates.Remove(id)

	workflows := w.store.Workflows.GetByTemplateID(id)
	for _, workflow := range workflows {
		w.store.Workflows.Remove(ctx, workflow.Id)
	}

	w.store.changeset.RecordDelete(workflowTemplate)
}
