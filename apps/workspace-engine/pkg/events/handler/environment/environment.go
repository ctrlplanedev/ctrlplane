package environment

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleEnvironmentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &pb.Environment{}
	if err := protojson.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	ws.Environments().Upsert(ctx, environment)
	ws.ReleaseManager().TaintEnvironmentsReleaseTargets(environment.Id)

	return nil
}

func HandleEnvironmentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &pb.Environment{}
	if err := protojson.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	ws.Environments().Upsert(ctx, environment)
	ws.ReleaseManager().TaintEnvironmentsReleaseTargets(environment.Id)

	return nil
}

func HandleEnvironmentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &pb.Environment{}
	if err := protojson.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	ws.Environments().Remove(ctx, environment.Id)
	ws.ReleaseManager().TaintEnvironmentsReleaseTargets(environment.Id)

	return nil
}
