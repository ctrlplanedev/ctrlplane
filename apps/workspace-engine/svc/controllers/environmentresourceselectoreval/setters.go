package environmentresourceselectoreval

import (
	"context"

	"github.com/google/uuid"
)

type Setter interface {
	SetComputedEnvironmentResources(ctx context.Context, environmentID uuid.UUID, resourceIDs []uuid.UUID) error
}
