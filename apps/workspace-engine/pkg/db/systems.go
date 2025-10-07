package db

import (
	"context"
	"workspace-engine/pkg/pb"

	"github.com/jackc/pgx/v5"
)

const SYSTEM_SELECT_QUERY = `
	SELECT
		s.id,
		s.workspace_id,
		s.name,
		s.description
	FROM system s
	WHERE s.workspace_id = $1
`

func getSystems(ctx context.Context, workspaceID string) ([]*pb.System, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, SYSTEM_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	systems := make([]*pb.System, 0)
	for rows.Next() {
		system, err := scanSystemRow(rows)
		if err != nil {
			return nil, err
		}
		systems = append(systems, system)
	}
	return systems, nil
}

func scanSystemRow(rows pgx.Rows) (*pb.System, error) {
	system := &pb.System{}
	err := rows.Scan(
		&system.Id,
		&system.WorkspaceId,
		&system.Name,
		&system.Description,
	)
	if err != nil {
		return nil, err
	}
	return system, nil
}
