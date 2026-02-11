package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

func NewJobAgents(store *Store) *JobAgents {
	return &JobAgents{
		repo:  store.repo,
		store: store,
	}
}

type JobAgents struct {
	repo  *memory.InMemory
	store *Store
}

func (j *JobAgents) Upsert(ctx context.Context, jobAgent *oapi.JobAgent) {
	j.repo.JobAgents.Set(jobAgent.Id, jobAgent)
	j.store.changeset.RecordUpsert(jobAgent)
}

func (j *JobAgents) Get(id string) (*oapi.JobAgent, bool) {
	jobAgent, ok := j.repo.JobAgents.Get(id)
	return jobAgent, ok
}

func (j *JobAgents) Remove(ctx context.Context, id string) {
	jobAgent, ok := j.repo.JobAgents.Get(id)
	if !ok || jobAgent == nil {
		return
	}

	j.repo.JobAgents.Remove(id)
	j.store.changeset.RecordDelete(jobAgent)
}

func (j *JobAgents) Items() map[string]*oapi.JobAgent {
	return j.repo.JobAgents.Items()
}
