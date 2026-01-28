package creators

import (
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func NewJobAgent(workspaceID string) *oapi.JobAgent {
	return &oapi.JobAgent{
		Id:          uuid.New().String(),
		Name:        "test-job-agent",
		Type:        "test-job-agent",
		WorkspaceId: workspaceID,
		Config:      map[string]any{},
	}
}
