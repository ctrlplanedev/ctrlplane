package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// NewPolicy creates a test Policy with sensible defaults
// All fields can be overridden via functional options
func NewPolicy(workspaceId string) *oapi.Policy {
	id := uuid.New().String()
	idSubstring := id[:8]

	description := fmt.Sprintf("Test policy %s", idSubstring)

	p := &oapi.Policy{
		Id:          id,
		Name:        fmt.Sprintf("policy-%s", idSubstring),
		Description: &description,
		CreatedAt:   time.Now().Format(time.RFC3339),
		WorkspaceId: workspaceId,
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules:       []oapi.PolicyRule{},
	}

	return p
}

// NewPolicyTargetSelector creates a test PolicyTargetSelector with optional selectors
func NewPolicyTargetSelector() *oapi.PolicyTargetSelector {
	id := uuid.New().String()

	return &oapi.PolicyTargetSelector{
		Id: id,
	}
}
