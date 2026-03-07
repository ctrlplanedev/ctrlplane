package policysummary

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/policysummary/summaryeval"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type summaryevalGetter = summaryeval.PostgresGetter

var _ Getter = (*PostgresGetter)(nil)

type PostgresGetter struct {
	*summaryevalGetter
	queries *db.Queries
}

func NewPostgresGetter(queries *db.Queries) *PostgresGetter {
	return &PostgresGetter{
		summaryevalGetter: summaryeval.NewPostgresGetter(queries),
		queries:           queries,
	}
}

func (g *PostgresGetter) GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error) {
	ver, err := g.queries.GetDeploymentVersionByID(ctx, versionID)
	if err != nil {
		return nil, fmt.Errorf("get version %s: %w", versionID, err)
	}
	return db.ToOapiDeploymentVersion(ver), nil
}

func (g *PostgresGetter) GetPoliciesForEnvironment(ctx context.Context, workspaceID, environmentID uuid.UUID) ([]*oapi.Policy, error) {
	rows, err := g.queries.ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: workspaceID,
		Limit:       pgtype.Int4{Int32: 5000, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("list policies for workspace %s: %w", workspaceID, err)
	}
	policies := make([]*oapi.Policy, 0, len(rows))
	for _, row := range rows {
		policies = append(policies, db.ToOapiPolicy(row))
	}
	return policies, nil
}

func (g *PostgresGetter) GetPoliciesForDeployment(ctx context.Context, workspaceID, deploymentID uuid.UUID) ([]*oapi.Policy, error) {
	rows, err := g.queries.ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: workspaceID,
		Limit:       pgtype.Int4{Int32: 5000, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("list policies for workspace %s: %w", workspaceID, err)
	}
	policies := make([]*oapi.Policy, 0, len(rows))
	for _, row := range rows {
		policies = append(policies, db.ToOapiPolicy(row))
	}
	return policies, nil
}
