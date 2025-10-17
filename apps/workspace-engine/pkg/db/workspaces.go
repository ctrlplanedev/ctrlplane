package db

import "context"

const WORKSPACE_SELECT_QUERY = `
	SELECT id FROM workspace
`

func GetWorkspaceIDs(ctx context.Context) ([]string, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, WORKSPACE_SELECT_QUERY)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	workspaceIDs := make([]string, 0)
	for rows.Next() {
		var workspaceID string
		err := rows.Scan(&workspaceID)
		if err != nil {
			return nil, err
		}
		workspaceIDs = append(workspaceIDs, workspaceID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return workspaceIDs, nil
}

const WORKSPACE_EXISTS_QUERY = `
	SELECT EXISTS(SELECT 1 FROM workspace WHERE id = $1)
`

func WorkspaceExists(ctx context.Context, workspaceId string) (bool, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return false, err
	}
	defer db.Release()

	var exists bool
	err = db.QueryRow(ctx, WORKSPACE_EXISTS_QUERY, workspaceId).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func GetAllWorkspaceIDs(ctx context.Context) ([]string, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	const query = `
		SELECT id FROM workspace
	`
	rows, err := db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workspaceIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		workspaceIDs = append(workspaceIDs, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return workspaceIDs, nil
}
