package policies

import (
	"context"
	"workspace-engine/pkg/pb"
)

// PolicyStore defines how to retrieve policies for evaluation.
type PolicyStore interface {
	// GetPoliciesForReleaseTarget returns all policies that apply to the given release target
	GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *pb.ReleaseTarget) ([]*pb.Policy, error)

	// GetPolicy retrieves a specific policy by ID
	Get(id string) (*pb.Policy, bool)
}