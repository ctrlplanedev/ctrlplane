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

type PostgresValidatorSetter struct{}

func (s *PostgresValidatorSetter) UpsertPlanTargetResultValidation(
	ctx context.Context,
	arg db.UpsertPlanTargetResultValidationParams,
) error {
	return db.GetQueries(ctx).UpsertPlanTargetResultValidation(ctx, arg)
}
