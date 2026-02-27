package environmentresourceselectoreval

import (
	"context"

	"github.com/google/uuid"
)

// EnvironmentInfo holds the environment data needed for resource selector evaluation.
type EnvironmentInfo struct {
	ResourceSelector string
	WorkspaceID      uuid.UUID
	// Raw is passed into the CEL evaluation context as the "environment" variable.
	Raw any
}

// ResourceInfo holds the resource data needed for selector matching.
type ResourceInfo struct {
	ID uuid.UUID
	// Raw is passed into the CEL evaluation context as the "resource" variable.
	Raw any
}

type Getter interface {
	GetEnvironmentInfo(ctx context.Context, environmentID uuid.UUID) (*EnvironmentInfo, error)
	// StreamResources sends batches of resources on the provided channel and
	// closes it when all rows have been sent (or on error). The caller creates
	// the channel and controls its buffer size.
	StreamResources(ctx context.Context, workspaceID uuid.UUID, batchSize int, batches chan<- []ResourceInfo) error
}
