package deploymentplan

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
)

type PostgresSetter struct {
	queue reconcile.Queue
}

func (s *PostgresSetter) CompletePlan(ctx context.Context, planID uuid.UUID) error {
	return db.GetQueries(ctx).UpdateDeploymentPlanCompleted(ctx, planID)
}

func (s *PostgresSetter) InsertTarget(
	ctx context.Context,
	planID, envID, resourceID uuid.UUID,
) (uuid.UUID, error) {
	targetID := uuid.New()
	_, err := db.GetQueries(ctx).
		InsertDeploymentPlanTarget(ctx, db.InsertDeploymentPlanTargetParams{
			ID:            targetID,
			PlanID:        planID,
			EnvironmentID: envID,
			ResourceID:    resourceID,
		})
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.UUID{}, ErrTargetExists
	}
	if err != nil {
		return uuid.UUID{}, err
	}
	return targetID, nil
}

func (s *PostgresSetter) InsertResult(
	ctx context.Context,
	targetID uuid.UUID,
	dispatchContext []byte,
) (uuid.UUID, error) {
	resultID := uuid.New()
	err := db.GetQueries(ctx).
		InsertDeploymentPlanTargetResult(ctx, db.InsertDeploymentPlanTargetResultParams{
			ID:              resultID,
			TargetID:        targetID,
			DispatchContext: dispatchContext,
		})
	if err != nil {
		return uuid.UUID{}, err
	}
	return resultID, nil
}

func (s *PostgresSetter) EnqueueResult(ctx context.Context, workspaceID, resultID string) error {
	return events.EnqueueDeploymentPlanTargetResult(
		s.queue,
		ctx,
		events.DeploymentPlanTargetResultParams{
			WorkspaceID: workspaceID,
			ResultID:    resultID,
		},
	)
}
