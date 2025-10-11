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

const DEPLOYMENT_VARIABLE_INSERT_QUERY = `
	INSERT INTO deployment_variable (id, key, description, deployment_id)
	VALUES ($1, $2, $3, $4)
`

func writeDeploymentVariable(ctx context.Context, deploymentVariable *oapi.DeploymentVariable, tx pgx.Tx) error {
	if _, err := tx.Exec(
		ctx,
		DEPLOYMENT_VARIABLE_INSERT_QUERY,
		deploymentVariable.Id,
		deploymentVariable.Key,
		deploymentVariable.Description,
		deploymentVariable.DeploymentId,
	); err != nil {
		return err
	}
	return nil
}

const DELETE_DEPLOYMENT_VARIABLE_QUERY = `
	DELETE FROM deployment_variable WHERE id = $1
`

func deleteDeploymentVariable(ctx context.Context, deploymentVariableId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_DEPLOYMENT_VARIABLE_QUERY, deploymentVariableId); err != nil {
		return err
	}
	return nil
}
