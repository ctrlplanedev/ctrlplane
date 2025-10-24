package resources

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandleResourceCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &oapi.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	resource.WorkspaceId = ws.ID

	if _, err := ws.Resources().Upsert(ctx, resource); err != nil {
		return err
	}

	return nil
}

func HandleResourceUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &oapi.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	if _, err := ws.Resources().Upsert(ctx, resource); err != nil {
		return err
	}

	return nil
}

func HandleResourceDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &oapi.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	ws.Resources().Remove(ctx, resource.Id)

	return nil
}
