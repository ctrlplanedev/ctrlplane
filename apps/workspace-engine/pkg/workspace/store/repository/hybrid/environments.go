package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type EnvironmentRepo struct {
	dbRepo *db.DBRepo
	mem    repository.EnvironmentRepo
}

func NewEnvironmentRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *EnvironmentRepo {
	return &EnvironmentRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.Environments(),
	}
}

func (r *EnvironmentRepo) Get(id string) (*oapi.Environment, bool) {
	return r.mem.Get(id)
}

func (r *EnvironmentRepo) Set(entity *oapi.Environment) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Environments().Set(entity)
}

func (r *EnvironmentRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Environments().Remove(id)
}

func (r *EnvironmentRepo) Items() map[string]*oapi.Environment {
	return r.mem.Items()
}
