package creators

import (
	"encoding/json"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func CustomJobAgentConfig(config map[string]any) oapi.JobAgentConfig {
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

	var cfg oapi.JobAgentConfig
	if err := cfg.UnmarshalJSON(b); err != nil {
		panic(err)
	}
	return cfg
}

func NewJobAgent(workspaceID string) *oapi.JobAgent {
	cfg := CustomJobAgentConfig(nil)
	return &oapi.JobAgent{
		Id:          uuid.New().String(),
		Name:        "test-job-agent",
		Type:        "test-job-agent",
		WorkspaceId: workspaceID,
		Config:      cfg,
	}
}
