package deploymentresourceselectoreval

import (
	"context"

	"github.com/google/uuid"
)

// DeploymentInfo holds the deployment data needed for resource selector evaluation.
type DeploymentInfo struct {
	ResourceSelector string
	WorkspaceID      uuid.UUID
	// Raw is passed into the CEL evaluation context as the "deployment" variable.
	Raw any
}

// ResourceInfo holds the resource data needed for selector matching.
type ResourceInfo struct {
	ID uuid.UUID
	// Raw is passed into the CEL evaluation context as the "resource" variable.
	Raw any
}

type Getter interface {
	GetDeploymentInfo(ctx context.Context, deploymentID uuid.UUID) (*DeploymentInfo, error)
	// StreamResources sends batches of resources on the provided channel and
	// closes it when all rows have been sent (or on error). The caller creates
	// the channel and controls its buffer size.
	StreamResources(ctx context.Context, workspaceID uuid.UUID, batchSize int, batches chan<- []ResourceInfo) error
}
