package deployments

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func selectorFromString(s string) *oapi.Selector {
	if s == "" || s == "false" {
		return nil
	}
	sel := &oapi.Selector{}
	// Try parsing as JSON selector first, fall back to CEL.
	if json.Valid([]byte(s)) {
		if err := sel.UnmarshalJSON([]byte(s)); err == nil {
			return sel
		}
	}
	celJSON, _ := json.Marshal(oapi.CelSelector{Cel: s})
	_ = sel.UnmarshalJSON(celJSON)
	return sel
}

func selectorToString(sel *oapi.Selector) string {
	if sel == nil {
		return "false"
	}
	b, err := sel.MarshalJSON()
	if err != nil {
		return "false"
	}
	return string(b)
}

// ToOapiFromGetRow converts a GetDeploymentByIDRow into an oapi.Deployment.
func ToOapiFromGetRow(row db.GetDeploymentByIDRow) *oapi.Deployment {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	jobAgentConfig := oapi.JobAgentConfig(row.JobAgentConfig)
	if jobAgentConfig == nil {
		jobAgentConfig = make(oapi.JobAgentConfig)
	}

	var jobAgentId *string
	if row.JobAgentID != uuid.Nil {
		s := row.JobAgentID.String()
		jobAgentId = &s
	}

	return &oapi.Deployment{
		Id:               row.ID.String(),
		Name:             row.Name,
		Description:      description,
		JobAgentId:       jobAgentId,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: selectorFromString(row.ResourceSelector),
		Metadata:         metadata,
		SystemId:         row.SystemID.String(),
	}
}

// ToOapiFromListRow converts a ListDeploymentsByWorkspaceIDRow into an oapi.Deployment.
func ToOapiFromListRow(row db.ListDeploymentsByWorkspaceIDRow) *oapi.Deployment {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	jobAgentConfig := oapi.JobAgentConfig(row.JobAgentConfig)
	if jobAgentConfig == nil {
		jobAgentConfig = make(oapi.JobAgentConfig)
	}

	var jobAgentId *string
	if row.JobAgentID != uuid.Nil {
		s := row.JobAgentID.String()
		jobAgentId = &s
	}

	return &oapi.Deployment{
		Id:               row.ID.String(),
		Name:             row.Name,
		Description:      description,
		JobAgentId:       jobAgentId,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: selectorFromString(row.ResourceSelector),
		Metadata:         metadata,
		SystemId:         row.SystemID.String(),
	}
}

// ToUpsertParams converts an oapi.Deployment into sqlc upsert params.
func ToUpsertParams(d *oapi.Deployment) (db.UpsertDeploymentParams, error) {
	id, err := uuid.Parse(d.Id)
	if err != nil {
		return db.UpsertDeploymentParams{}, fmt.Errorf("parse id: %w", err)
	}

	systemID, err := uuid.Parse(d.SystemId)
	if err != nil {
		return db.UpsertDeploymentParams{}, fmt.Errorf("parse system_id: %w", err)
	}
	_ = systemID // used by caller for system_deployment upsert

	var description pgtype.Text
	if d.Description != nil {
		description = pgtype.Text{String: *d.Description, Valid: true}
	}

	var jobAgentID uuid.UUID
	if d.JobAgentId != nil {
		parsed, err := uuid.Parse(*d.JobAgentId)
		if err != nil {
			return db.UpsertDeploymentParams{}, fmt.Errorf("parse job_agent_id: %w", err)
		}
		jobAgentID = parsed
	}

	metadata := d.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	jobAgentConfig := map[string]any(d.JobAgentConfig)
	if jobAgentConfig == nil {
		jobAgentConfig = make(map[string]any)
	}

	return db.UpsertDeploymentParams{
		ID:               id,
		Name:             d.Name,
		Description:      description,
		JobAgentID:       jobAgentID,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: selectorToString(d.ResourceSelector),
		Metadata:         metadata,
		WorkspaceID:      uuid.Nil, // set by caller
	}, nil
}
