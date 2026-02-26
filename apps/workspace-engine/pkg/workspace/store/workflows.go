package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewWorkflows(store *Store) *Workflows {
	return &Workflows{
		repo:  store.repo.Workflows(),
		store: store,
	}
}

type Workflows struct {
	repo  repository.WorkflowRepo
	store *Store
}

func (w *Workflows) SetRepo(repo repository.WorkflowRepo) {
	w.repo = repo
}

func (w *Workflows) Items() map[string]*oapi.Workflow {
	return w.repo.Items()
}

func (w *Workflows) Get(id string) (*oapi.Workflow, bool) {
	return w.repo.Get(id)
}

func (w *Workflows) Upsert(ctx context.Context, workflow *oapi.Workflow) {
	if err := w.repo.Set(workflow); err != nil {
		log.Error("Failed to upsert workflow", "error", err)
		return
	}
	w.store.changeset.RecordUpsert(workflow)
}

func (w *Workflows) Remove(ctx context.Context, id string) {
	workflow, ok := w.repo.Get(id)
	if !ok || workflow == nil {
		return
	}

	if err := w.repo.Remove(id); err != nil {
		log.Error("Failed to remove workflow", "error", err)
		return
	}

	workflowRuns := w.store.WorkflowRuns.GetByWorkflowId(id)
	for _, workflowRun := range workflowRuns {
		w.store.WorkflowRuns.Remove(ctx, workflowRun.Id)
	}

	w.store.changeset.RecordDelete(workflow)
}
