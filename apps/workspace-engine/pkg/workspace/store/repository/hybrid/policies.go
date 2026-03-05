package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type PolicyRepo struct {
	dbRepo *db.DBRepo
	mem    repository.PolicyRepo
}

func NewPolicyRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *PolicyRepo {
	return &PolicyRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.Policies(),
	}
}

func (r *PolicyRepo) Get(id string) (*oapi.Policy, bool) {
	return r.mem.Get(id)
}

func (r *PolicyRepo) Set(entity *oapi.Policy) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Policies().Set(entity)
}

func (r *PolicyRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Policies().Remove(id)
}

func (r *PolicyRepo) Items() map[string]*oapi.Policy {
	return r.mem.Items()
}
