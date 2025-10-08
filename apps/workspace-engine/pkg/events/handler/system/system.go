package system

import (
	"context"
	"encoding/json"
	"errors"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleSystemCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &pb.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		return err
	}

	ws.Systems().Upsert(ctx, system)
	ws.ReleaseManager().TaintAllReleaseTargets()

	return nil
}

func HandleSystemUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &pb.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		var payload struct {
			New *pb.System `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' system in update event")
		}
		system = payload.New
	}

	ws.Systems().Upsert(ctx, system)
	ws.ReleaseManager().TaintAllReleaseTargets()

	return nil
}

func HandleSystemDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &pb.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		return err
	}

	ws.Systems().Remove(ctx, system.Id)
	ws.ReleaseManager().TaintAllReleaseTargets()

	return nil
}
