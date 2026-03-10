package environmentresourceselectoreval

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

type PostgresSetter struct{}

func (s *PostgresSetter) SetComputedEnvironmentResources(
	ctx context.Context,
	environmentID uuid.UUID,
	resourceIDs []uuid.UUID,
) error {
	err := db.GetQueries(ctx).
		SetComputedEnvironmentResources(ctx, db.SetComputedEnvironmentResourcesParams{
			EnvironmentID: environmentID,
			ResourceIds:   resourceIDs,
		})
	if err != nil {
		return fmt.Errorf("set computed environment resources for %s: %w", environmentID, err)
	}
	return nil
}
