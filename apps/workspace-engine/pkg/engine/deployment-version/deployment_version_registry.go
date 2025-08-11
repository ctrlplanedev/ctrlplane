package deploymentversion

import (
	"context"
	"fmt"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/deployment"
)

var _ model.Repository[deployment.DeploymentVersion] = (*DeploymentVersionRepository)(nil)

type DeploymentVersionRepository struct {
	// DeploymentID -> DeploymentVersion sorted by createdAt
	DeploymentVersions map[string][]*deployment.DeploymentVersion
}

func NewDeploymentVersionRepository() *DeploymentVersionRepository {
	return &DeploymentVersionRepository{
		DeploymentVersions: make(map[string][]*deployment.DeploymentVersion),
	}
}

func (r *DeploymentVersionRepository) GetAllForDeployment(ctx context.Context, deploymentID string) []*deployment.DeploymentVersion {
	return r.DeploymentVersions[deploymentID]
}

func (r *DeploymentVersionRepository) GetAllReadyForDeployment(ctx context.Context, deploymentID string) []*deployment.DeploymentVersion {
	versions := r.GetAllForDeployment(ctx, deploymentID)
	readyVersions := make([]*deployment.DeploymentVersion, 0)
	for _, version := range versions {
		if version.Status == deployment.DeploymentVersionStatusReady {
			readyVersions = append(readyVersions, version)
		}
	}
	return readyVersions
}

func (r *DeploymentVersionRepository) GetAll(ctx context.Context) []*deployment.DeploymentVersion {
	allVersions := make([]*deployment.DeploymentVersion, 0)
	for _, versions := range r.DeploymentVersions {
		allVersions = append(allVersions, versions...)
	}
	return allVersions
}

func (r *DeploymentVersionRepository) Get(ctx context.Context, versionID string) *deployment.DeploymentVersion {
	for _, versions := range r.DeploymentVersions {
		for _, version := range versions {
			if version.ID == versionID {
				return version
			}
		}
	}
	return nil
}

func (r *DeploymentVersionRepository) Create(ctx context.Context, deploymentVersion *deployment.DeploymentVersion) error {
	if r.DeploymentVersions[deploymentVersion.DeploymentID] == nil {
		r.DeploymentVersions[deploymentVersion.DeploymentID] = make([]*deployment.DeploymentVersion, 0)
	}
	r.DeploymentVersions[deploymentVersion.DeploymentID] = append(r.DeploymentVersions[deploymentVersion.DeploymentID], deploymentVersion)
	return nil
}

func (r *DeploymentVersionRepository) Update(ctx context.Context, deploymentVersion *deployment.DeploymentVersion) error {
	for _, versions := range r.DeploymentVersions {
		for _, version := range versions {
			if version.ID == deploymentVersion.ID {
				*version = *deploymentVersion
				return nil
			}
		}
	}
	return fmt.Errorf("deployment version not found")
}

func (r *DeploymentVersionRepository) Delete(ctx context.Context, versionID string) error {
	for _, versions := range r.DeploymentVersions {
		for i, version := range versions {
			if version.ID == versionID {
				r.DeploymentVersions[versions[i].DeploymentID] = append(r.DeploymentVersions[versions[i].DeploymentID][:i], r.DeploymentVersions[versions[i].DeploymentID][i+1:]...)
				return nil
			}
		}
	}
	return fmt.Errorf("deployment version not found")
}

func (r *DeploymentVersionRepository) Exists(ctx context.Context, versionID string) bool {
	for _, versions := range r.DeploymentVersions {
		for _, version := range versions {
			if version.ID == versionID {
				return true
			}
		}
	}
	return false
}
