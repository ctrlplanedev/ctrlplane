package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type PolicySkipRepo struct {
	dbRepo *db.DBRepo
	mem    repository.PolicySkipRepo
}

func NewPolicySkipRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *PolicySkipRepo {
	return &PolicySkipRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.PolicySkips(),
	}
}

func (r *PolicySkipRepo) Get(id string) (*oapi.PolicySkip, bool) {
	return r.mem.Get(id)
}

func (r *PolicySkipRepo) Set(entity *oapi.PolicySkip) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.PolicySkips().Set(entity)
}

func (r *PolicySkipRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.PolicySkips().Remove(id)
}

func (r *PolicySkipRepo) Items() map[string]*oapi.PolicySkip {
	return r.mem.Items()
}
