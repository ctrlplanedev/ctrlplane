package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewResource creates a test Resource with sensible defaults
// All fields can be overridden via functional options
func NewResource(workspaceID string) *pb.Resource {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	r := &pb.Resource{
		Id:          id,
		Name:        fmt.Sprintf("r-%s", idSubstring),
		Version:     "v1.0.0",
		Kind:        "TestResource",
		Identifier:  fmt.Sprintf("r-%s", idSubstring),
		CreatedAt:   time.Now().Format(time.RFC3339),
		WorkspaceId: workspaceID,
		ProviderId:  nil,
		Config:      MustNewStructFromMap(map[string]any{}),
		LockedAt:    nil,
		UpdatedAt:   nil,
		DeletedAt:   nil,
		Metadata:    make(map[string]string),
	}

	return r
}
