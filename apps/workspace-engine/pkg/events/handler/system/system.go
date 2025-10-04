package system

import (
	"context"
	"encoding/json"
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

	return ws.Systems().Upsert(ctx, system)
}

func HandleSystemUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &pb.System{}
	if err := json.Unmarshal(event.Data, system); err != nil {
		return err
	}

	return ws.Systems().Upsert(ctx, system)
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

	return nil
}
