package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type DeploymentVersionRepo struct {
	dbRepo *db.DBRepo
	mem    repository.DeploymentVersionRepo
}

func NewDeploymentVersionRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *DeploymentVersionRepo {
	return &DeploymentVersionRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.DeploymentVersions(),
	}
}

func (r *DeploymentVersionRepo) Get(id string) (*oapi.DeploymentVersion, bool) {
	return r.mem.Get(id)
}

func (r *DeploymentVersionRepo) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error) {
	return r.mem.GetByDeploymentID(deploymentID)
}

func (r *DeploymentVersionRepo) Set(entity *oapi.DeploymentVersion) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.DeploymentVersions().Set(entity)
}

func (r *DeploymentVersionRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.DeploymentVersions().Remove(id)
}

func (r *DeploymentVersionRepo) Items() map[string]*oapi.DeploymentVersion {
	return r.mem.Items()
}
