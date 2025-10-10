package db

import (
	"context"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const DEPLOYMENT_VERSION_SELECT_QUERY = `
	SELECT
		dv.id,
		dv.name,
		dv.tag,
		dv.config,
		dv.job_agent_config,
		dv.deployment_id,
		dv.status,
		dv.message,
		dv.created_at
	FROM deployment_version dv
	INNER JOIN deployment d ON d.id = dv.deployment_id
	INNER JOIN system s ON s.id = d.system_id
	WHERE s.workspace_id = $1
`

func getDeploymentVersions(ctx context.Context, workspaceID string) ([]*oapi.DeploymentVersion, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, DEPLOYMENT_VERSION_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deploymentVersions := make([]*oapi.DeploymentVersion, 0)
	for rows.Next() {
		deploymentVersion, err := scanDeploymentVersion(rows)
		if err != nil {
			return nil, err
		}
		deploymentVersions = append(deploymentVersions, deploymentVersion)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return deploymentVersions, nil
}

func scanDeploymentVersion(rows pgx.Rows) (*oapi.DeploymentVersion, error) {
	var deploymentVersion oapi.DeploymentVersion
	var configJSON, jobAgentConfigJSON []byte
	var statusStr string
	var message *string
	var createdAt time.Time

	err := rows.Scan(
		&deploymentVersion.Id,
		&deploymentVersion.Name,
		&deploymentVersion.Tag,
		&configJSON,
		&jobAgentConfigJSON,
		&deploymentVersion.DeploymentId,
		&statusStr,
		&message,
		&createdAt,
	)
	if err != nil {
		return nil, err
	}

	// Set status from string to enum
	deploymentVersion.Status = convertStatusToEnum(statusStr)
	deploymentVersion.CreatedAt = createdAt.Format(time.RFC3339)

	// Handle nullable message field
	if message != nil {
		deploymentVersion.Message = message
	}

	// Parse JSON fields
	deploymentVersion.Config = parseJSONToStruct(configJSON)
	deploymentVersion.JobAgentConfig = parseJSONToStruct(jobAgentConfigJSON)

	return &deploymentVersion, nil
}

func convertStatusToEnum(statusStr string) oapi.DeploymentVersionStatus {
	switch statusStr {
	case "building":
		return oapi.DeploymentVersionStatusBuilding
	case "ready":
		return oapi.DeploymentVersionStatusReady
	case "failed":
		return oapi.DeploymentVersionStatusFailed
	case "rejected":
		return oapi.DeploymentVersionStatusRejected
	default:
		return oapi.DeploymentVersionStatusUnspecified
	}
}
