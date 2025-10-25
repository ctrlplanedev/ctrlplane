package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewJobAgents(store *Store) *JobAgents {
	return &JobAgents{
		repo: store.repo,
		store: store,
	}
}

type JobAgents struct {
	repo *repository.Repository
	store *Store
}

func (j *JobAgents) Upsert(ctx context.Context, jobAgent *oapi.JobAgent) {
	j.repo.JobAgents.Set(jobAgent.Id, jobAgent)

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, jobAgent)
	}

	j.store.changeset.RecordUpsert(jobAgent)
}

func (j *JobAgents) Get(id string) (*oapi.JobAgent, bool) {
	return j.repo.JobAgents.Get(id)
}

func (j *JobAgents) Remove(ctx context.Context, id string) {
	jobAgent, ok := j.repo.JobAgents.Get(id)
	if !ok || jobAgent == nil {
		return
	}

	j.repo.JobAgents.Remove(id)

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, jobAgent)
	}

	j.store.changeset.RecordDelete(jobAgent)
}

func (j *JobAgents) Items() map[string]*oapi.JobAgent {
	return j.repo.JobAgents.Items()
}
