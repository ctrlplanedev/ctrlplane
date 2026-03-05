package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type JobAgentRepo struct {
	dbRepo *db.DBRepo
	mem    repository.JobAgentRepo
}

func NewJobAgentRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *JobAgentRepo {
	return &JobAgentRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.JobAgents(),
	}
}

func (r *JobAgentRepo) Get(id string) (*oapi.JobAgent, bool) {
	return r.mem.Get(id)
}

func (r *JobAgentRepo) Set(entity *oapi.JobAgent) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.JobAgents().Set(entity)
}

func (r *JobAgentRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.JobAgents().Remove(id)
}

func (r *JobAgentRepo) Items() map[string]*oapi.JobAgent {
	return r.mem.Items()
}
