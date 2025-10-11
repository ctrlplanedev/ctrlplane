package db

import (
	"context"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
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

func getEnvironments(ctx context.Context, workspaceID string) ([]*oapi.Environment, error) {
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

	environments := make([]*oapi.Environment, 0)
	for rows.Next() {
		var environment oapi.Environment
		var createdAt time.Time
		err := rows.Scan(
			&environment.Id,
			&environment.Name,
			&environment.SystemId,
			&createdAt,
			&environment.Description,
			&environment.ResourceSelector,
		)
		if err != nil {
			return nil, err
		}
		environment.CreatedAt = createdAt.Format(time.RFC3339)
		environments = append(environments, &environment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return environments, nil
}

const ENVIRONMENT_UPSERT_QUERY = `
	INSERT INTO environment (id, name, system_id, description, resource_selector)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (id) DO UPDATE SET
		name = EXCLUDED.name,
		system_id = EXCLUDED.system_id,
		description = EXCLUDED.description,
		resource_selector = EXCLUDED.resource_selector
`

func writeEnvironment(ctx context.Context, environment *oapi.Environment, tx pgx.Tx) error {
	if _, err := tx.Exec(
		ctx,
		ENVIRONMENT_UPSERT_QUERY,
		environment.Id,
		environment.Name,
		environment.SystemId,
		environment.Description,
		environment.ResourceSelector,
	); err != nil {
		return err
	}
	return nil
}

const DELETE_ENVIRONMENT_QUERY = `
	DELETE FROM environment WHERE id = $1
`

func deleteEnvironment(ctx context.Context, environmentId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_ENVIRONMENT_QUERY, environmentId); err != nil {
		return err
	}
	return nil
}
