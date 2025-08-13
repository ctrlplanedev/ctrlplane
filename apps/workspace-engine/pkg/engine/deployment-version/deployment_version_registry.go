package deploymentversion

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
	"workspace-engine/pkg/model/deployment"
)

type DeploymentVersionRepository struct {
	// DeploymentID -> DeploymentVersions (in insertion order). To guarantee ordering, sort by CreatedAt descending on read
	DeploymentVersions map[string][]deployment.DeploymentVersion
	mu                 sync.RWMutex
}

func NewDeploymentVersionRepository() *DeploymentVersionRepository {
	return &DeploymentVersionRepository{
		DeploymentVersions: make(map[string][]deployment.DeploymentVersion),
	}
}

// GetAllForDeployment returns DeploymentVersion records for a given deploymentID,
// ordered by CreatedAt descending. If limit is non-nil, returns at most *limit items;
// otherwise returns all matching records.
func (r *DeploymentVersionRepository) GetAllForDeployment(ctx context.Context, deploymentID string, limit *int) []deployment.DeploymentVersion {
	r.mu.RLock()
	defer r.mu.RUnlock()

	src := r.DeploymentVersions[deploymentID]
	dst := make([]deployment.DeploymentVersion, len(src))
	copy(dst, src)
	sort.Slice(dst, func(i, j int) bool {
		return dst[i].CreatedAt.After(dst[j].CreatedAt)
	})
	if limit != nil {
		n := *limit
		if n > len(dst) {
			n = len(dst)
		}
		if n < 0 {
			n = 0
		}
		dst = dst[:n]
	}
	return dst
}

func (r *DeploymentVersionRepository) GetAll(ctx context.Context) []deployment.DeploymentVersion {
	r.mu.RLock()
	defer r.mu.RUnlock()

	allVersions := make([]deployment.DeploymentVersion, 0)
	for _, versions := range r.DeploymentVersions {
		allVersions = append(allVersions, versions...)
	}
	sort.Slice(allVersions, func(i, j int) bool {
		return allVersions[i].CreatedAt.After(allVersions[j].CreatedAt)
	})
	return allVersions
}

func (r *DeploymentVersionRepository) Get(ctx context.Context, versionID string) *deployment.DeploymentVersion {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, versions := range r.DeploymentVersions {
		for _, version := range versions {
			if version.ID == versionID {
				copy := version
				return &copy
			}
		}
	}
	return nil
}

func (r *DeploymentVersionRepository) Create(ctx context.Context, deploymentVersion deployment.DeploymentVersion) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if deploymentVersion.ID == "" {
		return fmt.Errorf("deployment version ID is required")
	}

	for _, versions := range r.DeploymentVersions {
		for _, version := range versions {
			if version.ID == deploymentVersion.ID {
				return fmt.Errorf("deployment version already exists")
			}
		}
	}

	if deploymentVersion.CreatedAt.IsZero() {
		deploymentVersion.CreatedAt = time.Now().UTC()
	}

	if r.DeploymentVersions[deploymentVersion.DeploymentID] == nil {
		r.DeploymentVersions[deploymentVersion.DeploymentID] = make([]deployment.DeploymentVersion, 0)
	}
	r.DeploymentVersions[deploymentVersion.DeploymentID] = append(r.DeploymentVersions[deploymentVersion.DeploymentID], deploymentVersion)
	return nil
}

func (r *DeploymentVersionRepository) Update(ctx context.Context, deploymentVersion deployment.DeploymentVersion) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, versions := range r.DeploymentVersions {
		for i, version := range versions {
			if version.ID == deploymentVersion.ID {
				versions[i] = deploymentVersion
				return nil
			}
		}
	}
	return fmt.Errorf("deployment version not found")
}

func (r *DeploymentVersionRepository) Delete(ctx context.Context, versionID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

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
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.DeploymentVersions[deploymentID]; !ok {
		return fmt.Errorf("deployment not found")
	}
	delete(r.DeploymentVersions, deploymentID)
	return nil
}

func (r *DeploymentVersionRepository) Exists(ctx context.Context, versionID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, versions := range r.DeploymentVersions {
		for _, version := range versions {
			if version.ID == versionID {
				return true
			}
		}
	}

	return false
}
