package variablemanager

import (
	"context"
	"sort"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store"
)

type VerisonRelease struct {
	ReleaseTarget *pb.ReleaseTarget
	Version       *pb.DeploymentVersion
}

type Manager struct {
	store *store.Store
}

func New(store *store.Store) *Manager {
	return &Manager{store: store}
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) *VerisonRelease {
	deploymentId := releaseTarget.GetDeploymentId()
	deployableVersions := m.store.DeploymentVersions.GetDeployableVersions(deploymentId)

	if len(deployableVersions) == 0 {
		return nil
	}

	// Get the latest version by CreatedAt
	sort.Slice(deployableVersions, func(i, j int) bool {
		return deployableVersions[i].CreatedAt > deployableVersions[j].CreatedAt
	})

	latestVersion := deployableVersions[0]

	return &VerisonRelease{
		ReleaseTarget: releaseTarget,
		Version:       latestVersion,
	}
}
