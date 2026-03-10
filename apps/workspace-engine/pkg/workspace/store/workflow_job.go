package store

import (
	"context"
	"sort"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

var workflowJobsTracer = otel.Tracer("workspace/store/workflow_jobs")

func NewWorkflowJobs(store *Store) *WorkflowJobs {
	return &WorkflowJobs{
		repo:  store.repo.WorkflowJobs(),
		store: store,
	}
}

type WorkflowJobs struct {
	repo  repository.WorkflowJobRepo
	store *Store
}

func (w *WorkflowJobs) SetRepo(repo repository.WorkflowJobRepo) {
	w.repo = repo
}

func (w *WorkflowJobs) Items() map[string]*oapi.WorkflowJob {
	return w.repo.Items()
}

func (w *WorkflowJobs) Get(id string) (*oapi.WorkflowJob, bool) {
	return w.repo.Get(id)
}

func (w *WorkflowJobs) Upsert(ctx context.Context, workflowJob *oapi.WorkflowJob) {
	_, span := workflowJobsTracer.Start(ctx, "UpsertWorkflowJob")
	defer span.End()

	if err := w.repo.Set(workflowJob); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert workflow job")
		log.Error("Failed to upsert workflow job", "error", err)
		return
	}
	w.store.changeset.RecordUpsert(workflowJob)
}

func (w *WorkflowJobs) Remove(ctx context.Context, id string) {
	workflowJob, ok := w.repo.Get(id)
	if !ok || workflowJob == nil {
		return
	}

	if err := w.repo.Remove(id); err != nil {
		log.Error("Failed to remove workflow job", "error", err)
		return
	}

	jobs := w.store.Jobs.GetByWorkflowJobId(id)
	for _, job := range jobs {
		w.store.Jobs.Remove(ctx, job.Id)
	}

	w.store.changeset.RecordDelete(workflowJob)
}

func (w *WorkflowJobs) GetByWorkflowRunId(workflowRunId string) []*oapi.WorkflowJob {
	wfJobs, err := w.repo.GetByWorkflowRunID(workflowRunId)
	if err != nil {
		return nil
	}
	sort.Slice(wfJobs, func(i, j int) bool {
		return wfJobs[i].Index < wfJobs[j].Index
	})
	return wfJobs
}
