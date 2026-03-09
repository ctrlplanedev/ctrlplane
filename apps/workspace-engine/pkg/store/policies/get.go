package policies

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type GetPolicies interface {
	GetPolicies(ctx context.Context, workspaceID string) ([]*oapi.Policy, error)
}

type PostgresGetPolicies struct{}

func (p *PostgresGetPolicies) GetPolicies(ctx context.Context, policyID string) (*oapi.Policy, error) {
	polUUID, err := uuid.Parse(policyID)
	if err != nil {
		return nil, fmt.Errorf("parse policy id: %w", err)
	}
	policy, err := db.GetQueries(ctx).GetPolicyByID(ctx, polUUID)
	if err != nil {
		return nil, fmt.Errorf("get policy by id: %w", err)
	}
	return db.ToOapiPolicy(policy), nil
}
