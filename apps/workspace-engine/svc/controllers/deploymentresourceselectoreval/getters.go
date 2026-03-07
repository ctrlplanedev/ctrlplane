package deploymentresourceselectoreval

import (
	"context"
	"workspace-engine/pkg/store/resources"

	"github.com/google/uuid"
)

// DeploymentInfo holds the deployment data needed for resource selector evaluation.
type DeploymentInfo struct {
	ResourceSelector string
	WorkspaceID      uuid.UUID
}

// ReleaseTarget is the (deployment, environment, resource) triple that
// represents a valid target for a release.
type ReleaseTarget struct {
	DeploymentID  uuid.UUID
	EnvironmentID uuid.UUID
	ResourceID    uuid.UUID
}

type Getter interface {
	resources.GetResources

	GetDeploymentInfo(ctx context.Context, deploymentID uuid.UUID) (*DeploymentInfo, error)
	// GetReleaseTargetsForDeployment returns all valid release targets for the
	// given deployment by joining computed resource tables through the system
	// link tables.
	GetReleaseTargetsForDeployment(ctx context.Context, deploymentID uuid.UUID) ([]ReleaseTarget, error)
}
