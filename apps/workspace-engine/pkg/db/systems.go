package db

import (
	"context"
	"workspace-engine/pkg/oapi"

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

func getSystems(ctx context.Context, workspaceID string) ([]*oapi.System, error) {
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

	systems := make([]*oapi.System, 0)
	for rows.Next() {
		system, err := scanSystemRow(rows)
		if err != nil {
			return nil, err
		}
		systems = append(systems, system)
	}
	return systems, nil
}

func scanSystemRow(rows pgx.Rows) (*oapi.System, error) {
	system := &oapi.System{}
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

const SYSTEM_UPSERT_QUERY = `
	INSERT INTO system (id, workspace_id, name, description)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (id) DO UPDATE SET
		workspace_id = EXCLUDED.workspace_id,
		name = EXCLUDED.name,
		description = EXCLUDED.description
`

func writeSystem(ctx context.Context, system *oapi.System, tx pgx.Tx) error {
	if _, err := tx.Exec(
		ctx,
		SYSTEM_UPSERT_QUERY,
		system.Id,
		system.WorkspaceId,
		system.Name,
		system.Description,
	); err != nil {
		return err
	}
	return nil
}

const DELETE_SYSTEM_QUERY = `
	DELETE FROM system WHERE id = $1
`

func deleteSystem(ctx context.Context, systemId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_SYSTEM_QUERY, systemId); err != nil {
		return err
	}
	return nil
}
