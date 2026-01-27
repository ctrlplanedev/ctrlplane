package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowTasks(store *Store) *WorkflowTasks {
	return &WorkflowTasks{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowTasks struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *WorkflowTasks) Items() map[string]*oapi.WorkflowTask {
	return w.repo.WorkflowTasks.Items()
}

func (w *WorkflowTasks) Get(id string) (*oapi.WorkflowTask, bool) {
	return w.repo.WorkflowTasks.Get(id)
}

func (w *WorkflowTasks) Upsert(ctx context.Context, id string, workflowTask *oapi.WorkflowTask) {
	w.repo.WorkflowTasks.Set(id, workflowTask)
	w.store.changeset.RecordUpsert(workflowTask)
}

func (w *WorkflowTasks) Remove(ctx context.Context, id string) {
	workflowTask, ok := w.repo.WorkflowTasks.Get(id)
	if !ok || workflowTask == nil {
		return
	}
	w.repo.WorkflowTasks.Remove(id)
	w.store.changeset.RecordDelete(workflowTask)
}
