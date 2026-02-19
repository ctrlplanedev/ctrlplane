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
	if s == "" {
		return nil
	}
	sel := &oapi.Selector{}
	celJSON, _ := json.Marshal(oapi.CelSelector{Cel: s})
	_ = sel.UnmarshalJSON(celJSON)
	return sel
}

func selectorToString(sel *oapi.Selector) string {
	if sel == nil {
		return "false"
	}
	cel, err := sel.AsCelSelector()
	if err == nil && cel.Cel != "" {
		return cel.Cel
	}
	return "false"
}

// ToOapi converts a db.Deployment into an oapi.Deployment.
func ToOapi(row db.Deployment) *oapi.Deployment {
	description := row.Description
	var descPtr *string
	if description != "" {
		descPtr = &description
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

	var resourceSelector *oapi.Selector
	if row.ResourceSelector.Valid {
		resourceSelector = selectorFromString(row.ResourceSelector.String)
	}

	return &oapi.Deployment{
		Id:               row.ID.String(),
		Name:             row.Name,
		Description:      descPtr,
		JobAgentId:       jobAgentId,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: resourceSelector,
		Metadata:         metadata,
	}
}

// ToUpsertParams converts an oapi.Deployment into sqlc upsert params.
func ToUpsertParams(d *oapi.Deployment) (db.UpsertDeploymentParams, error) {
	id, err := uuid.Parse(d.Id)
	if err != nil {
		return db.UpsertDeploymentParams{}, fmt.Errorf("parse id: %w", err)
	}

	description := ""
	if d.Description != nil {
		description = *d.Description
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

	selStr := selectorToString(d.ResourceSelector)
	resourceSelector := pgtype.Text{String: selStr, Valid: true}

	return db.UpsertDeploymentParams{
		ID:               id,
		Name:             d.Name,
		Description:      description,
		JobAgentID:       jobAgentID,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: resourceSelector,
		Metadata:         metadata,
		WorkspaceID:      uuid.Nil, // set by caller
	}, nil
}
