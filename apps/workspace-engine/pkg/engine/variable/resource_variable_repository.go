package variable

import (
	"context"
	"sync"
	"workspace-engine/pkg/model"
)

type ResourceVariable interface {
	GetID() string
	GetResourceID() string
	GetKey() string
	Resolve(ctx context.Context) (string, error)
}

var _ model.Repository[ResourceVariable] = (*ResourceVariableRepository)(nil)

type ResourceVariableRepository struct {
	variables map[string]*ResourceVariable
	mu        sync.RWMutex
}

func NewResourceVariableRepository() *ResourceVariableRepository {
	return &ResourceVariableRepository{variables: make(map[string]*ResourceVariable)}
}

func (r *ResourceVariableRepository) GetAll(ctx context.Context) []*ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *ResourceVariableRepository) GetAllByResourceID(ctx context.Context, resourceID string) []*ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *ResourceVariableRepository) GetByResourceIDAndKey(ctx context.Context, resourceID, key string) *ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *ResourceVariableRepository) Get(ctx context.Context, id string) *ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *ResourceVariableRepository) Create(ctx context.Context, variable *ResourceVariable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return nil
}

func (r *ResourceVariableRepository) Update(ctx context.Context, variable *ResourceVariable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return nil
}

func (r *ResourceVariableRepository) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return nil
}

func (r *ResourceVariableRepository) Exists(ctx context.Context, id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return false
}
