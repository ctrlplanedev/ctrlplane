package releasemanager

import (
	"context"
	"workspace-engine/pkg/pb"
)

type DeployVersion struct {
	Version *pb.DeploymentVersion
	Variables map[string]string
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*DeployVersion, error) {
	version := m.versionManager.Evaluate(ctx, releaseTarget)

	deployVersion := &DeployVersion{
		Version: version.Version,
		Variables: make(map[string]string),
	}

	return deployVersion, nil
}
