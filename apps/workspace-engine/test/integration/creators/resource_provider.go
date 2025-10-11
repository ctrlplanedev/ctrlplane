package creators

import (
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// NewResourceProvider creates a test ResourceProvider with sensible defaults
// All fields can be overridden via functional options
func NewResourceProvider(workspaceID string) *oapi.ResourceProvider {
	id := uuid.New().String()

	workspaceUUID, _ := uuid.Parse(workspaceID)

	rp := &oapi.ResourceProvider{
		Id:          id,
		Name:        "test-provider",
		CreatedAt:   time.Now(),
		WorkspaceId: openapi_types.UUID(workspaceUUID),
		Metadata:    make(map[string]string),
	}

	return rp
}
