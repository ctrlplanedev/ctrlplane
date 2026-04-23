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

	GetTargetContextByResultID(
		ctx context.Context,
		resultID uuid.UUID,
	) (db.GetTargetContextByResultIDRow, error)

	ListDeploymentPlanTargetResultsByTargetID(
		ctx context.Context,
		targetID uuid.UUID,
	) ([]db.ListDeploymentPlanTargetResultsByTargetIDRow, error)
}
