package creators

import (
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

// NewSystem creates a test System with sensible defaults
// All fields can be overridden via functional options.
func NewSystem(workspaceID string) *oapi.System {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	description := fmt.Sprintf("Test system %s", idSubstring)

	s := &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("system-%s", idSubstring),
		Description: &description,
	}

	return s
}
