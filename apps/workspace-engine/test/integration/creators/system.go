package creators

import (
	"fmt"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewSystem creates a test System with sensible defaults
// All fields can be overridden via functional options
func NewSystem(workspaceID string) *pb.System {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	s := &pb.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("system-%s", idSubstring),
		Description: fmt.Sprintf("Test system %s", idSubstring),
	}

	return s
}
