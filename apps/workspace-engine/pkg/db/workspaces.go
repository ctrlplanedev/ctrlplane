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
