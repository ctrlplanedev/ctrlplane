package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

func NewWorkflowRuns(store *Store) *WorkflowRuns {
	return &WorkflowRuns{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowRuns struct {
	repo  *memory.InMemory
	store *Store
}

func (w *WorkflowRuns) Items() map[string]*oapi.WorkflowRun {
	return w.repo.WorkflowRuns.Items()
}

func (w *WorkflowRuns) Get(id string) (*oapi.WorkflowRun, bool) {
	return w.repo.WorkflowRuns.Get(id)
}

func (w *WorkflowRuns) GetByWorkflowId(workflowId string) map[string]*oapi.WorkflowRun {
	workflowRuns := make(map[string]*oapi.WorkflowRun)
	for _, workflowRun := range w.repo.WorkflowRuns.Items() {
		if workflowRun.WorkflowId == workflowId {
			workflowRuns[workflowRun.Id] = workflowRun
		}
	}
	return workflowRuns
}

func (w *WorkflowRuns) Upsert(ctx context.Context, workflowRun *oapi.WorkflowRun) {
	w.repo.WorkflowRuns.Set(workflowRun.Id, workflowRun)
	w.store.changeset.RecordUpsert(workflowRun)
}

func (w *WorkflowRuns) Remove(ctx context.Context, id string) {
	workflowRun, ok := w.repo.WorkflowRuns.Get(id)
	if !ok || workflowRun == nil {
		return
	}
	w.repo.WorkflowRuns.Remove(id)

	workflowJobs := w.store.WorkflowJobs.GetByWorkflowRunId(id)
	for _, workflowJob := range workflowJobs {
		w.store.WorkflowJobs.Remove(ctx, workflowJob.Id)
	}

	w.store.changeset.RecordDelete(workflowRun)
}
