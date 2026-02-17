package jobagents

import (
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// ToOapi converts a db.JobAgent into an oapi.JobAgent.
func ToOapi(row db.JobAgent) *oapi.JobAgent {
	config := oapi.JobAgentConfig(row.Config)
	if config == nil {
		config = make(oapi.JobAgentConfig)
	}

	return &oapi.JobAgent{
		Id:          row.ID.String(),
		WorkspaceId: row.WorkspaceID.String(),
		Name:        row.Name,
		Type:        row.Type,
		Config:      config,
	}
}

// ToUpsertParams converts an oapi.JobAgent into sqlc upsert params.
func ToUpsertParams(ja *oapi.JobAgent) (db.UpsertJobAgentParams, error) {
	id, err := uuid.Parse(ja.Id)
	if err != nil {
		return db.UpsertJobAgentParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID, err := uuid.Parse(ja.WorkspaceId)
	if err != nil {
		return db.UpsertJobAgentParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	config := map[string]any(ja.Config)
	if config == nil {
		config = make(map[string]any)
	}

	return db.UpsertJobAgentParams{
		ID:          id,
		WorkspaceID: wsID,
		Name:        ja.Name,
		Type:        ja.Type,
		Config:      config,
	}, nil
}
