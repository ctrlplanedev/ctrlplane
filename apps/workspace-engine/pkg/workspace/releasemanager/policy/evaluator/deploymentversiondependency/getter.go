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
	// GetDependencies returns the dep edges declared by a single
	// deployment_version row. Edges are pinned per version.
	GetDependencies(ctx context.Context, deploymentVersionID string) ([]DependencyEdge, error)
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
