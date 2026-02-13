package systems

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// ToOapi converts a db.System into an oapi.System.
func ToOapi(s db.System) *oapi.System {
	var description *string
	if s.Description != "" {
		description = &s.Description
	}

	var metadata *map[string]string
	if s.Metadata != nil {
		m := make(map[string]string)
		if err := json.Unmarshal(s.Metadata, &m); err == nil {
			metadata = &m
		}
	}

	return &oapi.System{
		Id:          s.ID.String(),
		Name:        s.Name,
		Description: description,
		Metadata:    metadata,
		WorkspaceId: s.WorkspaceID.String(),
	}
}

// ToOapiFromListRow converts a ListSystemsByWorkspaceIDRow into an oapi.System.
func ToOapiFromListRow(row db.ListSystemsByWorkspaceIDRow) *oapi.System {
	var description *string
	if row.Description != "" {
		description = &row.Description
	}

	var metadata *map[string]string
	if row.Metadata != nil {
		m := make(map[string]string)
		if err := json.Unmarshal(row.Metadata, &m); err == nil {
			metadata = &m
		}
	}

	return &oapi.System{
		Id:          row.ID.String(),
		Name:        row.Name,
		Description: description,
		Metadata:    metadata,
		WorkspaceId: row.WorkspaceID.String(),
	}
}

// ToUpsertParams converts an oapi.System into sqlc upsert params.
func ToUpsertParams(s *oapi.System) (db.UpsertSystemParams, error) {
	id, err := uuid.Parse(s.Id)
	if err != nil {
		return db.UpsertSystemParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID, err := uuid.Parse(s.WorkspaceId)
	if err != nil {
		return db.UpsertSystemParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	description := ""
	if s.Description != nil {
		description = *s.Description
	}

	var metadataBytes []byte
	if s.Metadata != nil {
		metadataBytes, err = json.Marshal(*s.Metadata)
		if err != nil {
			return db.UpsertSystemParams{}, fmt.Errorf("marshal metadata: %w", err)
		}
	} else {
		metadataBytes = []byte("{}")
	}

	return db.UpsertSystemParams{
		ID:          id,
		Name:        s.Name,
		Description: description,
		WorkspaceID: wsID,
		Metadata:    metadataBytes,
	}, nil
}
