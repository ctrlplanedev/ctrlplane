package creators

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func CustomDeploymentJobAgentConfig(config map[string]any) oapi.DeploymentJobAgentConfig {
	if config == nil {
		config = map[string]any{}
	}
	if _, ok := config["type"]; !ok {
		config["type"] = "custom"
	}
	b, err := json.Marshal(config)
	if err != nil {
		panic(err)
	}

	var cfg oapi.DeploymentJobAgentConfig
	if err := cfg.UnmarshalJSON(b); err != nil {
		panic(err)
	}
	return cfg
}

// NewDeployment creates a test Deployment with sensible defaults
// All fields can be overridden via functional options
func NewDeployment(systemID string) *oapi.Deployment {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	description := fmt.Sprintf("Test deployment %s", idSubstring)

	cfg := CustomDeploymentJobAgentConfig(nil)

	d := &oapi.Deployment{
		Id:               id,
		Name:             fmt.Sprintf("d-%s", idSubstring),
		Slug:             fmt.Sprintf("d-%s", idSubstring),
		Description:      &description,
		SystemId:         systemID,
		JobAgentId:       nil,
		JobAgentConfig:   cfg,
		ResourceSelector: nil,
	}

	return d
}
