package variable

import (
	"context"
	"sync"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/resource"
)

type DeploymentVariable interface {
	GetID() string
	GetDeploymentID() string
	GetKey() string
	Resolve(ctx context.Context, resource *resource.Resource) (string, error)
}

var _ model.Repository[DeploymentVariable] = (*DeploymentVariableRepository)(nil)

type DeploymentVariableRepository struct {
	variables map[string]*DeploymentVariable
	mu        sync.RWMutex
}

func NewDeploymentVariableRepository() *DeploymentVariableRepository {
	return &DeploymentVariableRepository{variables: make(map[string]*DeploymentVariable)}
}

func (r *DeploymentVariableRepository) GetAll(ctx context.Context) []*DeploymentVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *DeploymentVariableRepository) GetAllByDeploymentID(ctx context.Context, deploymentID string) []*DeploymentVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *DeploymentVariableRepository) GetByDeploymentIDAndKey(ctx context.Context, deploymentID, key string) *DeploymentVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *DeploymentVariableRepository) Get(ctx context.Context, id string) *DeploymentVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return nil
}

func (r *DeploymentVariableRepository) Create(ctx context.Context, variable *DeploymentVariable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return nil
}

func (r *DeploymentVariableRepository) Update(ctx context.Context, variable *DeploymentVariable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return nil
}

func (r *DeploymentVariableRepository) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return nil
}

func (r *DeploymentVariableRepository) Exists(ctx context.Context, id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return false
}
