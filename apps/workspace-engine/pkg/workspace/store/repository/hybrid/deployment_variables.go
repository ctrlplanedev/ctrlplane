package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type DeploymentVariableRepo struct {
	dbRepo *db.DBRepo
	mem    repository.DeploymentVariableRepo
}

func NewDeploymentVariableRepo(
	dbRepo *db.DBRepo,
	inMemoryRepo *memory.InMemory,
) *DeploymentVariableRepo {
	return &DeploymentVariableRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.DeploymentVariables(),
	}
}

func (r *DeploymentVariableRepo) Get(id string) (*oapi.DeploymentVariable, bool) {
	return r.mem.Get(id)
}

func (r *DeploymentVariableRepo) GetByDeploymentID(
	deploymentID string,
) ([]*oapi.DeploymentVariable, error) {
	return r.mem.GetByDeploymentID(deploymentID)
}

func (r *DeploymentVariableRepo) Set(entity *oapi.DeploymentVariable) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.DeploymentVariables().Set(entity)
}

func (r *DeploymentVariableRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.DeploymentVariables().Remove(id)
}

func (r *DeploymentVariableRepo) Items() map[string]*oapi.DeploymentVariable {
	return r.mem.Items()
}

type DeploymentVariableValueRepo struct {
	dbRepo *db.DBRepo
	mem    repository.DeploymentVariableValueRepo
}

func NewDeploymentVariableValueRepo(
	dbRepo *db.DBRepo,
	inMemoryRepo *memory.InMemory,
) *DeploymentVariableValueRepo {
	return &DeploymentVariableValueRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.DeploymentVariableValues(),
	}
}

func (r *DeploymentVariableValueRepo) Get(id string) (*oapi.DeploymentVariableValue, bool) {
	return r.mem.Get(id)
}

func (r *DeploymentVariableValueRepo) GetByVariableID(
	variableID string,
) ([]*oapi.DeploymentVariableValue, error) {
	return r.mem.GetByVariableID(variableID)
}

func (r *DeploymentVariableValueRepo) Set(entity *oapi.DeploymentVariableValue) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.DeploymentVariableValues().Set(entity)
}

func (r *DeploymentVariableValueRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.DeploymentVariableValues().Remove(id)
}

func (r *DeploymentVariableValueRepo) Items() map[string]*oapi.DeploymentVariableValue {
	return r.mem.Items()
}
