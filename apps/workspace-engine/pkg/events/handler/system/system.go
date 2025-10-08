package system

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleSystemCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	system := &pb.System{}
	if err := protojson.Unmarshal(event.Data, system); err != nil {
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
	if err := protojson.Unmarshal(event.Data, system); err != nil {
		return err
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
	if err := protojson.Unmarshal(event.Data, system); err != nil {
		return err
	}

	ws.Systems().Remove(ctx, system.Id)
	ws.ReleaseManager().TaintAllReleaseTargets()

	return nil
}
