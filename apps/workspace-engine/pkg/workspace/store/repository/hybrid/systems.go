package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type SystemRepo struct {
	dbRepo *db.DBRepo
	mem    repository.SystemRepo
}

func NewSystemRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *SystemRepo {
	return &SystemRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.Systems(),
	}
}

func (r *SystemRepo) Get(id string) (*oapi.System, bool) {
	return r.mem.Get(id)
}

func (r *SystemRepo) Set(entity *oapi.System) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Systems().Set(entity)
}

func (r *SystemRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Systems().Remove(id)
}

func (r *SystemRepo) Items() map[string]*oapi.System {
	return r.mem.Items()
}
