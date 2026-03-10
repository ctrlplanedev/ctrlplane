package store

import (
	"context"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

var jobAgentsTracer = otel.Tracer("workspace/store/job_agents")

func NewJobAgents(store *Store) *JobAgents {
	return &JobAgents{
		repo:  store.repo.JobAgents(),
		store: store,
	}
}

type JobAgents struct {
	repo  repository.JobAgentRepo
	store *Store
}

// SetRepo replaces the underlying JobAgentRepo implementation.
func (j *JobAgents) SetRepo(repo repository.JobAgentRepo) {
	j.repo = repo
}

func (j *JobAgents) Upsert(ctx context.Context, jobAgent *oapi.JobAgent) {
	_, span := jobAgentsTracer.Start(ctx, "UpsertJobAgent")
	defer span.End()

	if err := j.repo.Set(jobAgent); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert job agent")
		log.Error("Failed to upsert job agent", "error", err)
	}
	j.store.changeset.RecordUpsert(jobAgent)
}

func (j *JobAgents) Get(id string) (*oapi.JobAgent, bool) {
	return j.repo.Get(id)
}

func (j *JobAgents) Remove(ctx context.Context, id string) {
	jobAgent, ok := j.repo.Get(id)
	if !ok || jobAgent == nil {
		return
	}

	j.repo.Remove(id)
	j.store.changeset.RecordDelete(jobAgent)
}

func (j *JobAgents) Items() map[string]*oapi.JobAgent {
	return j.repo.Items()
}
