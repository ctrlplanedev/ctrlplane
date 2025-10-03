package releasemanager

import (
	"context"
	"workspace-engine/pkg/pb"
)

type DeployVersion struct {
	Version   *pb.DeploymentVersion
	Variables map[string]any
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*DeployVersion, error) {
	version, err := m.versionManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	variables, err := m.variableManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	deployVersion := &DeployVersion{
		Version:   version,
		Variables: variables,
	}

	return deployVersion, err
}
