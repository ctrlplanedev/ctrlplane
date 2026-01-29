package store

import (
	"context"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowSteps(store *Store) *WorkflowSteps {
	return &WorkflowSteps{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowSteps struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *WorkflowSteps) Items() map[string]*oapi.WorkflowStep {
	return w.repo.WorkflowSteps.Items()
}

func (w *WorkflowSteps) Get(id string) (*oapi.WorkflowStep, bool) {
	return w.repo.WorkflowSteps.Get(id)
}

func (w *WorkflowSteps) Upsert(ctx context.Context, workflowStep *oapi.WorkflowStep) {
	w.repo.WorkflowSteps.Set(workflowStep.Id, workflowStep)
	w.store.changeset.RecordUpsert(workflowStep)
}

func (w *WorkflowSteps) Remove(ctx context.Context, id string) {
	workflowStep, ok := w.repo.WorkflowSteps.Get(id)
	if !ok || workflowStep == nil {
		return
	}
	w.repo.WorkflowSteps.Remove(id)
	w.store.changeset.RecordDelete(workflowStep)
}

func (w *WorkflowSteps) GetByWorkflowId(workflowId string) []*oapi.WorkflowStep {
	steps := make([]*oapi.WorkflowStep, 0)
	for _, step := range w.repo.WorkflowSteps.Items() {
		if step.WorkflowId == workflowId {
			steps = append(steps, step)
		}
	}
	sort.Slice(steps, func(i, j int) bool {
		return steps[i].Index < steps[j].Index
	})
	return steps
}
