package db

import (
	"context"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db/deploymentversions"
)

type DBRepo struct {
	deploymentVersions repository.DeploymentVersionRepo
}

func (d *DBRepo) DeploymentVersions() repository.DeploymentVersionRepo {
	return d.deploymentVersions
}

func NewDBRepo(ctx context.Context, workspaceID string) *DBRepo {
	return &DBRepo{
		deploymentVersions: deploymentversions.NewRepo(ctx, workspaceID),
	}
}
