package creators

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

// NewResource creates a test Resource with sensible defaults
// All fields can be overridden via functional options.
func NewResource(workspaceID string) *oapi.Resource {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	r := &oapi.Resource{
		Id:          id,
		Name:        fmt.Sprintf("r-%s", idSubstring),
		Version:     "v1.0.0",
		Kind:        "TestResource",
		Identifier:  fmt.Sprintf("r-%s", idSubstring),
		CreatedAt:   time.Now(),
		WorkspaceId: workspaceID,
		ProviderId:  nil,
		Config:      make(map[string]any),
		LockedAt:    nil,
		UpdatedAt:   nil,
		DeletedAt:   nil,
		Metadata:    make(map[string]string),
	}

	return r
}
