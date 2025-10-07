package db

import (
	"context"

	"workspace-engine/pkg/pb"
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

func GetDeployments(ctx context.Context, workspaceID string) ([]*pb.Deployment, error) {
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

	deployments := make([]*pb.Deployment, 0)
	for rows.Next() {
		var deployment pb.Deployment
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
