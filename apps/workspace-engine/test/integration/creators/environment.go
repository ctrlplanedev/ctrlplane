package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func NewJsonSelector(json map[string]any) *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: json,
	})
	return selector
}

// NewEnvironment creates a test Environment with sensible defaults
// All fields can be overridden via functional options
func NewEnvironment(systemID string) *oapi.Environment {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
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
		SystemIds:        []string{systemID},
		ResourceSelector: selector,
		CreatedAt:        time.Now(),
	}

	return e
}
