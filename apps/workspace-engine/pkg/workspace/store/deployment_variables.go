package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewDeploymentVariables(store *Store) *DeploymentVariables {
	return &DeploymentVariables{
		repo: store.repo,
	}
}

type DeploymentVariables struct {
	repo *repository.Repository
}

func (d *DeploymentVariables) IterBuffered() <-chan cmap.Tuple[string, *pb.DeploymentVariable] {
	return d.repo.DeploymentVariables.IterBuffered()
}

func (d *DeploymentVariables) Get(id string) (*pb.DeploymentVariable, bool) {
	return d.repo.DeploymentVariables.Get(id)
}

func (d *DeploymentVariables) Values(varableId string) map[string]*pb.DeploymentVariableValue {
	values := make(map[string]*pb.DeploymentVariableValue)
	return values
}

func (d *DeploymentVariables) Upsert(id string, deploymentVariable *pb.DeploymentVariable) {
	d.repo.DeploymentVariables.Set(id, deploymentVariable)
}

func (d *DeploymentVariables) Remove(id string) {
	d.repo.DeploymentVariables.Remove(id)
}
