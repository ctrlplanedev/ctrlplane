package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type ResourceProviderRepo struct {
	dbRepo *db.DBRepo
	mem    repository.ResourceProviderRepo
}

func NewResourceProviderRepo(
	dbRepo *db.DBRepo,
	inMemoryRepo *memory.InMemory,
) *ResourceProviderRepo {
	return &ResourceProviderRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.ResourceProviders(),
	}
}

func (r *ResourceProviderRepo) Get(id string) (*oapi.ResourceProvider, bool) {
	return r.mem.Get(id)
}

func (r *ResourceProviderRepo) Set(entity *oapi.ResourceProvider) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.ResourceProviders().Set(entity)
}

func (r *ResourceProviderRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.ResourceProviders().Remove(id)
}

func (r *ResourceProviderRepo) Items() map[string]*oapi.ResourceProvider {
	return r.mem.Items()
}
