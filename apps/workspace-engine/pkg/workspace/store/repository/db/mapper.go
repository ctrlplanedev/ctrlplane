package db

import (
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ToOapi converts a db.DeploymentVersion row into an oapi.DeploymentVersion.
func ToOapi(dv db.DeploymentVersion) (*oapi.DeploymentVersion, error) {
	var message *string
	if dv.Message.Valid {
		message = &dv.Message.String
	}

	metadata := dv.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	config := dv.Config
	if config == nil {
		config = make(map[string]any)
	}

	jobAgentConfig := oapi.JobAgentConfig(dv.JobAgentConfig)
	if jobAgentConfig == nil {
		jobAgentConfig = make(oapi.JobAgentConfig)
	}

	return &oapi.DeploymentVersion{
		Id:             dv.ID.String(),
		Name:           dv.Name,
		Tag:            dv.Tag,
		Config:         config,
		JobAgentConfig: jobAgentConfig,
		DeploymentId:   dv.DeploymentID.String(),
		Status:         oapi.DeploymentVersionStatus(dv.Status),
		Message:        message,
		Metadata:       metadata,
		CreatedAt:      dv.CreatedAt.Time,
	}, nil
}

// ToUpsertParams converts an oapi.DeploymentVersion into sqlc upsert params.
func ToUpsertParams(wsId string, v *oapi.DeploymentVersion) (db.UpsertDeploymentVersionParams, error) {
	id, err := uuid.Parse(v.Id)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("parse id: %w", err)
	}

	workspaceID, err := uuid.Parse(wsId)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	deploymentID, err := uuid.Parse(v.DeploymentId)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("parse deployment_id: %w", err)
	}

	var message pgtype.Text
	if v.Message != nil {
		message = pgtype.Text{String: *v.Message, Valid: true}
	}

	var createdAt pgtype.Timestamptz
	if !v.CreatedAt.IsZero() {
		createdAt = pgtype.Timestamptz{Time: v.CreatedAt, Valid: true}
	}

	metadata := v.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	config := v.Config
	if config == nil {
		config = make(map[string]any)
	}

	jobAgentConfig := map[string]any(v.JobAgentConfig)
	if jobAgentConfig == nil {
		jobAgentConfig = make(map[string]any)
	}

	return db.UpsertDeploymentVersionParams{
		ID:             id,
		Name:           v.Name,
		Tag:            v.Tag,
		Config:         config,
		JobAgentConfig: jobAgentConfig,
		DeploymentID:   deploymentID,
		Metadata:       metadata,
		Status:         db.DeploymentVersionStatus(v.Status),
		Message:        message,
		WorkspaceID:    workspaceID,
		CreatedAt:      createdAt,
	}, nil
}
