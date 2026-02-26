package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewWorkflowRuns(store *Store) *WorkflowRuns {
	return &WorkflowRuns{
		repo:  store.repo.WorkflowRuns(),
		store: store,
	}
}

type WorkflowRuns struct {
	repo  repository.WorkflowRunRepo
	store *Store
}

func (w *WorkflowRuns) SetRepo(repo repository.WorkflowRunRepo) {
	w.repo = repo
}

func (w *WorkflowRuns) Items() map[string]*oapi.WorkflowRun {
	return w.repo.Items()
}

func (w *WorkflowRuns) Get(id string) (*oapi.WorkflowRun, bool) {
	return w.repo.Get(id)
}

func (w *WorkflowRuns) GetByWorkflowId(workflowId string) map[string]*oapi.WorkflowRun {
	runs, err := w.repo.GetByWorkflowID(workflowId)
	if err != nil {
		return make(map[string]*oapi.WorkflowRun)
	}
	result := make(map[string]*oapi.WorkflowRun, len(runs))
	for _, r := range runs {
		result[r.Id] = r
	}
	return result
}

func (w *WorkflowRuns) Upsert(ctx context.Context, workflowRun *oapi.WorkflowRun) {
	if err := w.repo.Set(workflowRun); err != nil {
		log.Error("Failed to upsert workflow run", "error", err)
		return
	}
	w.store.changeset.RecordUpsert(workflowRun)
}

func (w *WorkflowRuns) Remove(ctx context.Context, id string) {
	workflowRun, ok := w.repo.Get(id)
	if !ok || workflowRun == nil {
		return
	}

	if err := w.repo.Remove(id); err != nil {
		log.Error("Failed to remove workflow run", "error", err)
		return
	}

	workflowJobs := w.store.WorkflowJobs.GetByWorkflowRunId(id)
	for _, workflowJob := range workflowJobs {
		w.store.WorkflowJobs.Remove(ctx, workflowJob.Id)
	}

	w.store.changeset.RecordDelete(workflowRun)
}
