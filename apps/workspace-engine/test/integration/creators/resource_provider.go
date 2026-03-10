package creators

import (
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

// NewResourceProvider creates a test ResourceProvider with sensible defaults
// All fields can be overridden via functional options.
func NewResourceProvider(workspaceID string) *oapi.ResourceProvider {
	id := uuid.New().String()

	workspaceUUID, _ := uuid.Parse(workspaceID)

	rp := &oapi.ResourceProvider{
		Id:          id,
		Name:        "test-provider",
		CreatedAt:   time.Now(),
		WorkspaceId: workspaceUUID,
		Metadata:    make(map[string]string),
	}

	return rp
}
