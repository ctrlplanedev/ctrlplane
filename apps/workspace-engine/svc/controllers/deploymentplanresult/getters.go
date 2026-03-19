package deploymentplanresult

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

// Getter abstracts read operations needed by the plan result controller.
type Getter interface {
	GetDeploymentPlanTargetResult(
		ctx context.Context,
		id uuid.UUID,
	) (db.DeploymentPlanTargetResult, error)
}
