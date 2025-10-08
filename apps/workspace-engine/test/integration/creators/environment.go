package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewEnvironment creates a test Environment with sensible defaults
// All fields can be overridden via functional options
func NewEnvironment(systemID string) *pb.Environment {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	allResources := MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})

	description := fmt.Sprintf("Test environment %s", idSubstring)

	e := &pb.Environment{
		Id:               id,
		Name:             fmt.Sprintf("env-%s", idSubstring),
		Description:      &description,
		SystemId:         systemID,
		ResourceSelector: pb.NewJsonSelector(allResources),
		CreatedAt:        time.Now().Format(time.RFC3339),
	}

	return e
}
