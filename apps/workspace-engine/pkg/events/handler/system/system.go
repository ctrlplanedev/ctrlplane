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
	ws.ReleaseManager().TaintAllReleaseTargets()

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
	ws.ReleaseManager().TaintAllReleaseTargets()

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

	ws.Systems().Remove(ctx, system.Id)
	ws.ReleaseManager().TaintAllReleaseTargets()

	return nil
}
