package environmentresourceselectoreval

import (
	"context"
	"workspace-engine/pkg/store/resources"

	"github.com/google/uuid"
)

// EnvironmentInfo holds the environment data needed for resource selector evaluation.
type EnvironmentInfo struct {
	ResourceSelector string
	WorkspaceID      uuid.UUID
}

type Getter interface {
	resources.GetResources

	GetEnvironmentInfo(ctx context.Context, environmentID uuid.UUID) (*EnvironmentInfo, error)
}
