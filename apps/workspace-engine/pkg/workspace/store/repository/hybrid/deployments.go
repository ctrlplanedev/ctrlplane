package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type DeploymentRepo struct {
	dbRepo *db.DBRepo
	mem    repository.DeploymentRepo
}

func NewDeploymentRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *DeploymentRepo {
	return &DeploymentRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.Deployments(),
	}
}

func (r *DeploymentRepo) Get(id string) (*oapi.Deployment, bool) {
	return r.mem.Get(id)
}

func (r *DeploymentRepo) Set(entity *oapi.Deployment) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Deployments().Set(entity)
}

func (r *DeploymentRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Deployments().Remove(id)
}

func (r *DeploymentRepo) Items() map[string]*oapi.Deployment {
	return r.mem.Items()
}
