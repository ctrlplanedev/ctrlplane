package creators

import (
	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

func NewJobAgent(workspaceID string) *oapi.JobAgent {
	return &oapi.JobAgent{
		Id:          uuid.New().String(),
		Name:        "test-job-agent",
		Type:        "test-runner",
		WorkspaceId: workspaceID,
		Config:      map[string]any{},
	}
}
