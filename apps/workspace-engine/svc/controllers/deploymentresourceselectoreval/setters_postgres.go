package deploymentresourceselectoreval

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

type PostgresSetter struct{}

func (s *PostgresSetter) SetComputedDeploymentResources(
	ctx context.Context,
	deploymentID uuid.UUID,
	resourceIDs []uuid.UUID,
) error {
	err := db.GetQueries(ctx).
		SetComputedDeploymentResources(ctx, db.SetComputedDeploymentResourcesParams{
			DeploymentID: deploymentID,
			ResourceIds:  resourceIDs,
		})
	if err != nil {
		return fmt.Errorf("set computed deployment resources for %s: %w", deploymentID, err)
	}
	return nil
}
