package githubentities

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandleGithubEntityCreated(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	githubEntity := &oapi.GithubEntity{}
	if err := json.Unmarshal(event.Data, githubEntity); err != nil {
		return err
	}

	ws.GithubEntities().Upsert(ctx, githubEntity)

	return nil
}

func HandleGithubEntityUpdated(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	githubEntity := &oapi.GithubEntity{}
	if err := json.Unmarshal(event.Data, githubEntity); err != nil {
		return err
	}

	ws.GithubEntities().Upsert(ctx, githubEntity)

	return nil
}

func HandleGithubEntityDeleted(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	githubEntity := &oapi.GithubEntity{}
	if err := json.Unmarshal(event.Data, githubEntity); err != nil {
		return err
	}

	ws.GithubEntities().Remove(ctx, githubEntity.Slug, githubEntity.InstallationId)

	return nil
}
