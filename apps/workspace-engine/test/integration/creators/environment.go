package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// NewEnvironment creates a test Environment with sensible defaults
// All fields can be overridden via functional options
func NewEnvironment(systemID string) *oapi.Environment {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "name",
			"operator": "starts-with",
			"value":    "",
		},
	})

	description := fmt.Sprintf("Test environment %s", idSubstring)

	e := &oapi.Environment{
		Id:               id,
		Name:             fmt.Sprintf("env-%s", idSubstring),
		Description:      &description,
		SystemId:         systemID,
		ResourceSelector: selector,
		CreatedAt:        time.Now().Format(time.RFC3339),
	}

	return e
}
