package db

import (
	"context"

	"github.com/uptrace/bun"
)

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
	db := GetBunDB(ctx)
	defer db.Close()

	type Workspace struct {
		bun.BaseModel `bun:"workspace"`
		ID            string `bun:"id"`
	}

	var workspaces []Workspace
	var ids []string

	err := db.NewSelect().
		Model(&workspaces).
		Column("id").
		Scan(ctx, &ids)

	if err != nil {
		return nil, err
	}

	return ids, nil
}
