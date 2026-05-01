package deploymentplanresult

import (
	"context"

	"workspace-engine/pkg/db"
)

// Setter abstracts write operations needed by the plan result controller.
type Setter interface {
	UpdateDeploymentPlanTargetResultCompleted(
		ctx context.Context,
		arg db.UpdateDeploymentPlanTargetResultCompletedParams,
	) error
	UpdateDeploymentPlanTargetResultState(
		ctx context.Context,
		arg db.UpdateDeploymentPlanTargetResultStateParams,
	) error
	UpsertPlanValidationResult(
		ctx context.Context,
		arg db.UpsertPlanValidationResultParams,
	) error
}
