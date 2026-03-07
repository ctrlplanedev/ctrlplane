package policies

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type GetPoliciesForWorkspace interface {
	GetPoliciesForWorkspace(ctx context.Context, workspaceID string) ([]*oapi.Policy, error)
}

type PostgresGetPoliciesForWorkspace struct{}

func (p *PostgresGetPoliciesForWorkspace) GetPoliciesForWorkspace(ctx context.Context, workspaceID string) ([]*oapi.Policy, error) {
	policies, err := db.GetQueries(ctx).ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
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
