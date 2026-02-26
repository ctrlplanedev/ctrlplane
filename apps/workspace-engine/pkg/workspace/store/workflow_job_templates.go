package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewWorkflowJobTemplates(store *Store) *WorkflowJobTemplates {
	return &WorkflowJobTemplates{
		repo:  store.repo.WorkflowJobTemplates(),
		store: store,
	}
}

type WorkflowJobTemplates struct {
	repo  repository.WorkflowJobTemplateRepo
	store *Store
}

func (w *WorkflowJobTemplates) SetRepo(repo repository.WorkflowJobTemplateRepo) {
	w.repo = repo
}

func (w *WorkflowJobTemplates) Items() map[string]*oapi.WorkflowJobTemplate {
	return w.repo.Items()
}

func (w *WorkflowJobTemplates) Get(id string) (*oapi.WorkflowJobTemplate, bool) {
	return w.repo.Get(id)
}

func (w *WorkflowJobTemplates) Upsert(ctx context.Context, workflowJobTemplate *oapi.WorkflowJobTemplate) {
	if err := w.repo.Set(workflowJobTemplate); err != nil {
		log.Error("Failed to upsert workflow job template", "error", err)
		return
	}
	w.store.changeset.RecordUpsert(workflowJobTemplate)
}

func (w *WorkflowJobTemplates) Remove(ctx context.Context, id string) {
	workflowJobTemplate, ok := w.repo.Get(id)
	if !ok || workflowJobTemplate == nil {
		return
	}
	if err := w.repo.Remove(id); err != nil {
		log.Error("Failed to remove workflow job template", "error", err)
		return
	}
	w.store.changeset.RecordDelete(workflowJobTemplate)
}
