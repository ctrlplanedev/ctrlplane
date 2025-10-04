package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

type DeploymentVariables struct {
	repo *repository.Repository
}

func (d *DeploymentVariables) IterBuffered() <-chan cmap.Tuple[string, *pb.DeploymentVariable] {
	return d.repo.DeploymentVariables.IterBuffered()
}

func (d *DeploymentVariables) Get(id string) (*pb.DeploymentVariable, bool) {
	return d.repo.DeploymentVariables.Get(id)
}

func (d *DeploymentVariables) Values(variableId string) map[string]*pb.DeploymentVariableValue {
	values := make(map[string]*pb.DeploymentVariableValue)
	return values
}
