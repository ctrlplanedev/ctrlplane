package db

import (
	"context"
	"workspace-engine/pkg/workspace/store/repository"
)

type DBRepo struct {
	deploymentVersions repository.DeploymentVersionRepo
}

func (d *DBRepo) DeploymentVersions() repository.DeploymentVersionRepo {
	return d.deploymentVersions
}

func NewDBRepo(ctx context.Context, workspaceID string) *DBRepo {
	return &DBRepo{
		deploymentVersions: NewDeploymentVersionRepo(ctx, workspaceID),
	}
}
