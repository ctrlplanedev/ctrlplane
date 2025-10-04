package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewSystem creates a test System with sensible defaults
// All fields can be overridden via functional options
func NewSystem() *pb.System {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	s := &pb.System{
		Id:          id,
		Name:        fmt.Sprintf("system-%s", idSubstring),
		Description: fmt.Sprintf("Test system %s", idSubstring),
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	return s
}

