package system

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandleSystemCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &oapi.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		return err
	}

	if err := ws.Systems().Upsert(ctx, system); err != nil {
		return err
	}

	return nil
}

func HandleSystemUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &oapi.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		return err
	}

	if err := ws.Systems().Upsert(ctx, system); err != nil {
		return err
	}

	return nil
}

func HandleSystemDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &oapi.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		return err
	}

	deployments := ws.Systems().Deployments(system.Id)
	environments := ws.Systems().Environments(system.Id)
	releaseTargets, err := ws.ReleaseTargets().GetForSystem(ctx, system.Id)
	if err != nil {
		return err
	}

	for _, deployment := range deployments {
		ws.Deployments().Remove(ctx, deployment.Id)
	}
	for _, environment := range environments {
		ws.Environments().Remove(ctx, environment.Id)
	}
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseTargets().Remove(releaseTarget.Key())
	}

	ws.Systems().Remove(ctx, system.Id)

	return nil
}
