package db

import (
	"context"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const GITHUB_ENTITY_SELECT_QUERY = `
	SELECT
		installation_id,
		slug
	FROM github_entity
	WHERE workspace_id = $1
`

func getGithubEntities(ctx context.Context, workspaceID string) ([]*oapi.GithubEntity, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, GITHUB_ENTITY_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	githubEntities := make([]*oapi.GithubEntity, 0)
	for rows.Next() {
		githubEntity, err := scanGithubEntity(rows)
		if err != nil {
			return nil, err
		}
		githubEntities = append(githubEntities, githubEntity)
	}
	return githubEntities, nil
}

func scanGithubEntity(rows pgx.Rows) (*oapi.GithubEntity, error) {
	var githubEntity oapi.GithubEntity
	err := rows.Scan(&githubEntity.InstallationId, &githubEntity.Slug)
	if err != nil {
		return nil, err
	}
	return &githubEntity, nil
}
