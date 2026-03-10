package policies

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type GetPolicies interface {
	GetPolicies(ctx context.Context, workspaceID string) ([]*oapi.Policy, error)
}

type PostgresGetPolicies struct{}

func (p *PostgresGetPolicies) GetPolicies(
	ctx context.Context,
	policyID string,
) (*oapi.Policy, error) {
	policy, err := db.GetQueries(ctx).GetPolicyByID(ctx, uuid.MustParse(policyID))
	if err != nil {
		return nil, fmt.Errorf("get policy by id: %w", err)
	}
	return db.ToOapiPolicy(policy), nil
}
