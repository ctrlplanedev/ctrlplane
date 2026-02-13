package db

import (
	"context"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db/deployments"
	"workspace-engine/pkg/workspace/store/repository/db/deploymentversions"
	"workspace-engine/pkg/workspace/store/repository/db/environments"
	"workspace-engine/pkg/workspace/store/repository/db/systems"
)

type DBRepo struct {
	deploymentVersions repository.DeploymentVersionRepo
	deployments        repository.DeploymentRepo
	environments       repository.EnvironmentRepo
	systems            repository.SystemRepo
}

func (d *DBRepo) DeploymentVersions() repository.DeploymentVersionRepo {
	return d.deploymentVersions
}

func (d *DBRepo) Deployments() repository.DeploymentRepo {
	return d.deployments
}

func (d *DBRepo) Environments() repository.EnvironmentRepo {
	return d.environments
}

func (d *DBRepo) Systems() repository.SystemRepo {
	return d.systems
}

func NewDBRepo(ctx context.Context, workspaceID string) *DBRepo {
	return &DBRepo{
		deploymentVersions: deploymentversions.NewRepo(ctx, workspaceID),
		deployments:        deployments.NewRepo(ctx, workspaceID),
		environments:       environments.NewRepo(ctx, workspaceID),
		systems:            systems.NewRepo(ctx, workspaceID),
	}
}
