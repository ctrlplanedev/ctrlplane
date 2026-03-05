package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type ResourceVariableRepo struct {
	dbRepo *db.DBRepo
	mem    repository.ResourceVariableRepo
}

func NewResourceVariableRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *ResourceVariableRepo {
	return &ResourceVariableRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.ResourceVariables(),
	}
}

func (r *ResourceVariableRepo) Get(key string) (*oapi.ResourceVariable, bool) {
	return r.mem.Get(key)
}

func (r *ResourceVariableRepo) GetByResourceID(resourceID string) ([]*oapi.ResourceVariable, error) {
	return r.mem.GetByResourceID(resourceID)
}

func (r *ResourceVariableRepo) Set(entity *oapi.ResourceVariable) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.ResourceVariables().Set(entity)
}

func (r *ResourceVariableRepo) Remove(key string) error {
	if err := r.mem.Remove(key); err != nil {
		return err
	}
	return r.dbRepo.ResourceVariables().Remove(key)
}

func (r *ResourceVariableRepo) Items() map[string]*oapi.ResourceVariable {
	return r.mem.Items()
}

func (r *ResourceVariableRepo) BulkUpdate(toUpsert []*oapi.ResourceVariable, toRemove []*oapi.ResourceVariable) error {
	if err := r.mem.BulkUpdate(toUpsert, toRemove); err != nil {
		return err
	}
	return r.dbRepo.ResourceVariables().BulkUpdate(toUpsert, toRemove)
}
