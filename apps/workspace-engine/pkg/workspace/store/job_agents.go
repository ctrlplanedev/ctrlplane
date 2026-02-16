package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

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
	if err := j.repo.Set(jobAgent); err != nil {
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
