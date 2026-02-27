package deploymentresourceselectoreval

import (
	"context"

	"github.com/google/uuid"
)

type Setter interface {
	SetComputedDeploymentResources(ctx context.Context, deploymentID uuid.UUID, resourceIDs []uuid.UUID) error
}
