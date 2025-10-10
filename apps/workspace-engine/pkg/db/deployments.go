package db

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const DEPLOYMENT_SELECT_QUERY = `
	SELECT
		d.id,
		d.name,
		d.slug,
		d.description,
		d.system_id,
		d.job_agent_id,
		d.job_agent_config,
		d.resource_selector
	FROM deployment d
	INNER JOIN system s ON s.id = d.system_id
	WHERE s.workspace_id = $1
`

func getDeployments(ctx context.Context, workspaceID string) ([]*oapi.Deployment, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, DEPLOYMENT_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deployments := make([]*oapi.Deployment, 0)
	for rows.Next() {
		var deployment oapi.Deployment
		err := rows.Scan(
			&deployment.Id,
			&deployment.Name,
			&deployment.Slug,
			&deployment.Description,
			&deployment.SystemId,
			&deployment.JobAgentId,
			&deployment.JobAgentConfig,
			&deployment.ResourceSelector,
		)
		if err != nil {
			return nil, err
		}
		deployments = append(deployments, &deployment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return deployments, nil
}

const DEPLOYMENT_INSERT_QUERY = `
	INSERT INTO deployment (id, name, slug, description, system_id, job_agent_id, job_agent_config, resource_selector)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`

func writeDeployment(ctx context.Context, deployment *oapi.Deployment, tx pgx.Tx) error {
	if _, err := tx.Exec(
		ctx,
		DEPLOYMENT_INSERT_QUERY,
		deployment.Id,
		deployment.Name,
		deployment.Slug,
		deployment.Description,
		deployment.SystemId,
		deployment.JobAgentId,
		deployment.JobAgentConfig,
		deployment.ResourceSelector,
	); err != nil {
		return err
	}

	return nil
}

const DELETE_DEPLOYMENT_QUERY = `
	DELETE FROM deployment WHERE id = $1
`

func deleteDeployment(ctx context.Context, deploymentId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_DEPLOYMENT_QUERY, deploymentId); err != nil {
		return err
	}
	return nil
}
