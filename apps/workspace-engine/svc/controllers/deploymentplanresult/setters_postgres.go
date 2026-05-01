package deploymentplanresult

import (
	"context"

	"workspace-engine/pkg/db"
)

type PostgresSetter struct{}

func (s *PostgresSetter) UpdateDeploymentPlanTargetResultCompleted(
	ctx context.Context,
	arg db.UpdateDeploymentPlanTargetResultCompletedParams,
) error {
	return db.GetQueries(ctx).UpdateDeploymentPlanTargetResultCompleted(ctx, arg)
}

func (s *PostgresSetter) UpdateDeploymentPlanTargetResultState(
	ctx context.Context,
	arg db.UpdateDeploymentPlanTargetResultStateParams,
) error {
	return db.GetQueries(ctx).UpdateDeploymentPlanTargetResultState(ctx, arg)
}

func (s *PostgresSetter) UpsertPlanValidationResult(
	ctx context.Context,
	arg db.UpsertPlanValidationResultParams,
) error {
	return db.GetQueries(ctx).UpsertPlanValidationResult(ctx, arg)
}
