package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type Repo struct {
	dbRepo  *db.DBRepo
	memJobs repository.JobRepo
}

func NewRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *Repo {
	return &Repo{
		dbRepo:  dbRepo,
		memJobs: inMemoryRepo.JobsRepo(),
	}
}

func (r *Repo) Get(id string) (*oapi.Job, bool) {
	return r.memJobs.Get(id)
}

func (r *Repo) Set(entity *oapi.Job) error {
	if err := r.memJobs.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Jobs().Set(entity)
}

func (r *Repo) Remove(id string) error {
	if err := r.memJobs.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Jobs().Remove(id)
}

func (r *Repo) Items() map[string]*oapi.Job {
	return r.memJobs.Items()
}

func (r *Repo) GetByAgentID(agentID string) ([]*oapi.Job, error) {
	return r.memJobs.GetByAgentID(agentID)
}

func (r *Repo) GetByReleaseID(releaseID string) ([]*oapi.Job, error) {
	return r.memJobs.GetByReleaseID(releaseID)
}
