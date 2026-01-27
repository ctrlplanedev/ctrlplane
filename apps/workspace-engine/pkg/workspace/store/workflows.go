package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflows(store *Store) *Workflows {
	return &Workflows{
		repo:  store.repo,
		store: store,
	}
}

type Workflows struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *Workflows) Items() map[string]*oapi.Workflow {
	return w.repo.Workflows.Items()
}

func (w *Workflows) Get(id string) (*oapi.Workflow, bool) {
	return w.repo.Workflows.Get(id)
}

func (w *Workflows) Upsert(ctx context.Context, workflow *oapi.Workflow) {
	w.repo.Workflows.Set(workflow.Id, workflow)
	w.store.changeset.RecordUpsert(workflow)
}

func (w *Workflows) Remove(ctx context.Context, id string) {
	workflow, ok := w.repo.Workflows.Get(id)
	if !ok || workflow == nil {
		return
	}
	w.repo.Workflows.Remove(id)
	w.store.changeset.RecordDelete(workflow)
}
