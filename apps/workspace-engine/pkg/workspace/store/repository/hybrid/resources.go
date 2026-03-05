package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type ResourceRepo struct {
	dbRepo *db.DBRepo
	mem    repository.ResourceRepo
}

func NewResourceRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *ResourceRepo {
	return &ResourceRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.Resources(),
	}
}

func (r *ResourceRepo) Get(id string) (*oapi.Resource, bool) {
	return r.mem.Get(id)
}

func (r *ResourceRepo) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	return r.mem.GetByIdentifier(identifier)
}

func (r *ResourceRepo) GetByIdentifiers(identifiers []string) map[string]*oapi.Resource {
	return r.mem.GetByIdentifiers(identifiers)
}

func (r *ResourceRepo) GetSummariesByIdentifiers(identifiers []string) map[string]*repository.ResourceSummary {
	return r.mem.GetSummariesByIdentifiers(identifiers)
}

func (r *ResourceRepo) ListByProviderID(providerID string) []*oapi.Resource {
	return r.mem.ListByProviderID(providerID)
}

func (r *ResourceRepo) Set(entity *oapi.Resource) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Resources().Set(entity)
}

func (r *ResourceRepo) SetBatch(entities []*oapi.Resource) error {
	if err := r.mem.SetBatch(entities); err != nil {
		return err
	}
	return r.dbRepo.Resources().SetBatch(entities)
}

func (r *ResourceRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Resources().Remove(id)
}

func (r *ResourceRepo) RemoveBatch(ids []string) error {
	if err := r.mem.RemoveBatch(ids); err != nil {
		return err
	}
	return r.dbRepo.Resources().RemoveBatch(ids)
}

func (r *ResourceRepo) Items() map[string]*oapi.Resource {
	return r.mem.Items()
}
