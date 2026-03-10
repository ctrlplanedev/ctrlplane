package policies

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type GetPoliciesForWorkspace interface {
	GetPoliciesForWorkspace(ctx context.Context, workspaceID string) ([]*oapi.Policy, error)
}

type PostgresGetPoliciesForWorkspace struct{}

func (p *PostgresGetPoliciesForWorkspace) GetPoliciesForWorkspace(
	ctx context.Context,
	workspaceID string,
) ([]*oapi.Policy, error) {
	policies, err := db.GetQueries(ctx).
		ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
			WorkspaceID: uuid.MustParse(workspaceID),
		})
	if err != nil {
		return nil, fmt.Errorf("get all policies: %w", err)
	}
	policiesOapi := make([]*oapi.Policy, 0, len(policies))
	for _, policy := range policies {
		policiesOapi = append(policiesOapi, db.ToOapiPolicy(policy))
	}
	return policiesOapi, nil
}
