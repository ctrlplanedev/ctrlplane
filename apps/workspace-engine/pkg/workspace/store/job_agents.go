package store

import (
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewJobAgents(store *Store) *JobAgents {
	return &JobAgents{
		repo: store.repo,
	}
}

type JobAgents struct {
	repo *repository.Repository
}

func (j *JobAgents) Upsert(jobAgent *pb.JobAgent) {
	j.repo.JobAgents.Set(jobAgent.Id, jobAgent)
}

func (j *JobAgents) Get(id string) (*pb.JobAgent, bool) {
	return j.repo.JobAgents.Get(id)
}

func (j *JobAgents) Remove(id string) {
	j.repo.JobAgents.Remove(id)
}
