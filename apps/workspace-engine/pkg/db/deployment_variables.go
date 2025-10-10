package db

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const DEPLOYMENT_VARIABLE_SELECT_QUERY = `
	SELECT
		dv.id,
		dv.key,
		dv.description,
		dv.deployment_id
	FROM deployment_variable dv
	INNER JOIN deployment d ON d.id = dv.deployment_id
	INNER JOIN system s ON s.id = d.system_id
	WHERE s.workspace_id = $1
`

func getDeploymentVariables(ctx context.Context, workspaceID string) ([]*oapi.DeploymentVariable, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, DEPLOYMENT_VARIABLE_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deploymentVariables := make([]*oapi.DeploymentVariable, 0)
	for rows.Next() {
		deploymentVariable, err := scanDeploymentVariable(rows)
		if err != nil {
			return nil, err
		}
		deploymentVariables = append(deploymentVariables, deploymentVariable)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return deploymentVariables, nil
}

func scanDeploymentVariable(rows pgx.Rows) (*oapi.DeploymentVariable, error) {
	var deploymentVariable oapi.DeploymentVariable

	err := rows.Scan(
		&deploymentVariable.Id,
		&deploymentVariable.Key,
		&deploymentVariable.Description,
		&deploymentVariable.DeploymentId,
	)
	if err != nil {
		return nil, err
	}

	return &deploymentVariable, nil
}
