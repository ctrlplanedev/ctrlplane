package db

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ToOapi converts a db.DeploymentVersion row into an oapi.DeploymentVersion.
func ToOapi(dv db.DeploymentVersion) (*oapi.DeploymentVersion, error) {
	config := make(map[string]any)
	if len(dv.Config) > 0 {
		if err := json.Unmarshal(dv.Config, &config); err != nil {
			return nil, fmt.Errorf("unmarshal config: %w", err)
		}
	}

	jobAgentConfig := make(oapi.JobAgentConfig)
	if len(dv.JobAgentConfig) > 0 {
		if err := json.Unmarshal(dv.JobAgentConfig, &jobAgentConfig); err != nil {
			return nil, fmt.Errorf("unmarshal job_agent_config: %w", err)
		}
	}

	var message *string
	if dv.Message.Valid {
		message = &dv.Message.String
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
		CreatedAt:      dv.CreatedAt.Time,
	}, nil
}

// ToUpsertParams converts an oapi.DeploymentVersion into sqlc upsert params.
func ToUpsertParams(wsId string, v *oapi.DeploymentVersion) (db.UpsertDeploymentVersionParams, error) {
	workspaceID, err := uuid.Parse(wsId)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	configBytes, err := json.Marshal(v.Config)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("marshal config: %w", err)
	}

	jobAgentConfigBytes, err := json.Marshal(v.JobAgentConfig)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("marshal job_agent_config: %w", err)
	}

	deploymentID, err := uuid.Parse(v.DeploymentId)
	if err != nil {
		return db.UpsertDeploymentVersionParams{}, fmt.Errorf("parse deployment_id: %w", err)
	}

	var message pgtype.Text
	if v.Message != nil {
		message = pgtype.Text{String: *v.Message, Valid: true}
	}

	return db.UpsertDeploymentVersionParams{
		Name:           v.Name,
		Tag:            v.Tag,
		Config:         configBytes,
		JobAgentConfig: jobAgentConfigBytes,
		DeploymentID:   deploymentID,
		Status:         db.DeploymentVersionStatus(v.Status),
		Message:        message,
		WorkspaceID:    workspaceID,
	}, nil
}
