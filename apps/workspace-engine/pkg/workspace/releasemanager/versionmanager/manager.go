package versionmanager

import (
	"context"
	"sort"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store"
)

type Manager struct {
	store *store.Store
}

func New(store *store.Store) *Manager {
	return &Manager{store: store}
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*pb.DeploymentVersion, error) {
	deployableVersions := m.store.
		DeploymentVersions.
		DeployableTo(releaseTarget)

	if len(deployableVersions) == 0 {
		return nil, nil
	}

	// Get the latest version by CreatedAt
	sort.Slice(deployableVersions, func(i, j int) bool {
		return deployableVersions[i].CreatedAt > deployableVersions[j].CreatedAt
	})

	latestVersion := deployableVersions[0]

	return latestVersion, nil
}
