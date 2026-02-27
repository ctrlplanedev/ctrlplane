package deploymentresourceselectoreval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"

	"github.com/google/uuid"
)

type PostgresSetter struct{}

func (s *PostgresSetter) SetComputedDeploymentResources(ctx context.Context, deploymentID uuid.UUID, resourceIDs []uuid.UUID) error {
	err := db.GetQueries(ctx).SetComputedDeploymentResources(ctx, db.SetComputedDeploymentResourcesParams{
		DeploymentID: deploymentID,
		ResourceIds:  resourceIDs,
	})
	if err != nil {
		return fmt.Errorf("set computed deployment resources for %s: %w", deploymentID, err)
	}
	return nil
}
