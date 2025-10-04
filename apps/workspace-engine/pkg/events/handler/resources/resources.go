package resources

import (
	"context"
	"encoding/json"
	"errors"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleResourceCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &pb.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	if resource.WorkspaceId != ws.ID {
		return errors.New("resource workspace id does not match workspace id")
	}

	ws.Resources().Upsert(ctx, resource)

	return nil
}

func HandleResourceUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &pb.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	ws.Resources().Upsert(ctx, resource)

	return nil
}

func HandleResourceDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &pb.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	ws.Resources().Remove(resource.Id)

	return nil
}
