package deploymentversion

import (
	"context"
	"fmt"
	"sort"
	"time"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/deployment"
)

var _ model.Repository[deployment.DeploymentVersion] = (*DeploymentVersionRepository)(nil)

type DeploymentVersionRepository struct {
	// DeploymentID -> DeploymentVersions (in insertion order). To guarantee ordering, sort by CreatedAt on insert.
	DeploymentVersions map[string][]*deployment.DeploymentVersion
}

func NewDeploymentVersionRepository() *DeploymentVersionRepository {
	return &DeploymentVersionRepository{
		DeploymentVersions: make(map[string][]*deployment.DeploymentVersion),
	}
}

func (r *DeploymentVersionRepository) GetAllForDeployment(ctx context.Context, deploymentID string) []*deployment.DeploymentVersion {
	src := r.DeploymentVersions[deploymentID]
	dst := make([]*deployment.DeploymentVersion, len(src))
	copy(dst, src)
	return dst
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
	if deploymentVersion.ID == "" {
		return fmt.Errorf("deployment version ID is required")
	}

	if r.Exists(ctx, deploymentVersion.ID) {
		return fmt.Errorf("deployment version already exists")
	}

	if deploymentVersion.CreatedAt.IsZero() {
		deploymentVersion.CreatedAt = time.Now().UTC()
	}

	if deploymentVersion.Status == "" {
		deploymentVersion.Status = deployment.DeploymentVersionStatusReady
	}

	if r.DeploymentVersions[deploymentVersion.DeploymentID] == nil {
		r.DeploymentVersions[deploymentVersion.DeploymentID] = make([]*deployment.DeploymentVersion, 0)
	}
	r.DeploymentVersions[deploymentVersion.DeploymentID] = append(r.DeploymentVersions[deploymentVersion.DeploymentID], deploymentVersion)
	sort.Slice(r.DeploymentVersions[deploymentVersion.DeploymentID], func(i, j int) bool {
		return r.DeploymentVersions[deploymentVersion.DeploymentID][i].CreatedAt.After(r.DeploymentVersions[deploymentVersion.DeploymentID][j].CreatedAt)
	})
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
	for depID, versions := range r.DeploymentVersions {
		for i, version := range versions {
			if version.ID == versionID {
				r.DeploymentVersions[depID] = append(r.DeploymentVersions[depID][:i], r.DeploymentVersions[depID][i+1:]...)
				return nil
			}
		}
	}
	return fmt.Errorf("deployment version not found")
}

func (r *DeploymentVersionRepository) DeleteDeployment(ctx context.Context, deploymentID string) error {
	if _, ok := r.DeploymentVersions[deploymentID]; !ok {
		return fmt.Errorf("deployment not found")
	}
	delete(r.DeploymentVersions, deploymentID)
	return nil
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
