package creators

import (
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// NewDeployment creates a test Deployment with sensible defaults
// All fields can be overridden via functional options
func NewDeployment(systemID string) *oapi.Deployment {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	description := fmt.Sprintf("Test deployment %s", idSubstring)

	d := &oapi.Deployment{
		Id:               id,
		Name:             fmt.Sprintf("d-%s", idSubstring),
		Slug:             fmt.Sprintf("d-%s", idSubstring),
		Description:      &description,
		SystemIds:        []string{systemID},
		JobAgentId:       nil,
		JobAgentConfig:   map[string]any{},
		ResourceSelector: nil,
	}

	return d
}
