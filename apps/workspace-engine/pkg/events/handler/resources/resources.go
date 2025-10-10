package resources

import (
	"context"
	"errors"
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

	if resource.WorkspaceId != ws.ID {
		return errors.New("resource workspace id does not match workspace id")
	}

	ws.Resources().Upsert(ctx, resource)
	ws.ReleaseManager().TaintResourcesReleaseTargets(resource.Id)

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

	ws.Resources().Upsert(ctx, resource)
	ws.ReleaseManager().TaintResourcesReleaseTargets(resource.Id)

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
