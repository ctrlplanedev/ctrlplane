package deploymentversiondependency

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type DependencyEdge struct {
	DependencyDeploymentID string
	VersionSelector        string
}

type Getters interface {
	GetDependencies(ctx context.Context, deploymentID string) ([]DependencyEdge, error)
	GetReleaseTargetForDeploymentResource(
		ctx context.Context,
		deploymentID string,
		resourceID string,
	) (*oapi.ReleaseTarget, error)
	GetCurrentVersionForReleaseTarget(
		ctx context.Context,
		rt *oapi.ReleaseTarget,
	) (*oapi.DeploymentVersion, error)
}
