package deploymentplanresult

import (
	"context"

	"workspace-engine/pkg/db"

	"github.com/google/uuid"
)

// Getter abstracts read operations needed by the plan result controller.
type Getter interface {
	GetDeploymentPlanTargetResult(ctx context.Context, id uuid.UUID) (db.DeploymentPlanTargetResult, error)
}
