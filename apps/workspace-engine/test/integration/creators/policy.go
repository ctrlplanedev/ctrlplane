package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewPolicy creates a test Policy with sensible defaults
// All fields can be overridden via functional options
func NewPolicy(workspaceId string) *pb.Policy {
	id := uuid.New().String()
	idSubstring := id[:8]

	p := &pb.Policy{
		Id:          id,
		Name:        fmt.Sprintf("policy-%s", idSubstring),
		Description: fmt.Sprintf("Test policy %s", idSubstring),
		CreatedAt:   time.Now().Format(time.RFC3339),
		WorkspaceId: workspaceId,
		Selectors:   []*pb.PolicyTargetSelector{},
		Rules:       []*pb.PolicyRule{},
	}

	return p
}

// NewPolicyTargetSelector creates a test PolicyTargetSelector with optional selectors
func NewPolicyTargetSelector() *pb.PolicyTargetSelector {
	id := uuid.New().String()

	return &pb.PolicyTargetSelector{
		Id: id,
	}
}

