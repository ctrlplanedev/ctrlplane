package versionmanager

import (
	"sort"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store"

	"context"
)

type Manager struct {
	store *store.Store
}

func New(store *store.Store) *Manager {
	return &Manager{
		store: store,
	}
}

// GetCandidateVersions returns all versions for a deployment, sorted newest to oldest.
// The caller is responsible for filtering based on policies or other criteria.
func (m *Manager) GetCandidateVersions(ctx context.Context, releaseTarget *pb.ReleaseTarget) []*pb.DeploymentVersion {
	versions := m.store.DeploymentVersions.Items()

	// Filter versions for the given deployment
	filtered := make([]*pb.DeploymentVersion, 0, len(versions))
	for _, version := range versions {
		if version.DeploymentId == releaseTarget.DeploymentId {
			filtered = append(filtered, version)
		}
	}

	// Sort by CreatedAt (descending: newest first)
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt > filtered[j].CreatedAt
	})

	return filtered
}
