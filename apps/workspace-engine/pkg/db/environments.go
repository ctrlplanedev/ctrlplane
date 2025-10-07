package db

import (
	"context"

	"workspace-engine/pkg/pb"
)

const ENVIRONMENT_SELECT_QUERY = `
	SELECT
		e.id,
		e.name,
		e.system_id,
		e.created_at,
		e.description,
		e.resource_selector
	FROM environment e
	INNER JOIN system s ON s.id = e.system_id
	WHERE s.workspace_id = $1
`

func GetEnvironments(ctx context.Context, workspaceID string) ([]*pb.Environment, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, ENVIRONMENT_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	environments := make([]*pb.Environment, 0)
	for rows.Next() {
		var environment pb.Environment
		err := rows.Scan(&environment.Id, &environment.Name, &environment.SystemId, &environment.CreatedAt, &environment.Description, &environment.ResourceSelector)
		if err != nil {
			return nil, err
		}
		environments = append(environments, &environment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return environments, nil
}
