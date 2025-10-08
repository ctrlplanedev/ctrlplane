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
	ws.ReleaseManager().TaintResourcesReleaseTargets(resource.Id)

	return nil
}

func HandleResourceUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	newResource := &pb.Resource{}
	if err := json.Unmarshal(event.Data, newResource); err != nil {
		// @depricated
		var payload struct {
			New *pb.Resource `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' resource in update event")
		}
		newResource = payload.New
	}

	ws.Resources().Upsert(ctx, newResource)
	ws.ReleaseManager().TaintResourcesReleaseTargets(newResource.Id)

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

	ws.Resources().Remove(ctx, resource.Id)

	return nil
}
