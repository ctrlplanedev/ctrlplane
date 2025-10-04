package environment

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleEnvironmentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &pb.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	return ws.Environments().Upsert(ctx, environment)
}

func HandleEnvironmentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &pb.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	return ws.Environments().Upsert(ctx, environment)
}

func HandleEnvironmentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &pb.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	ws.Environments().Remove(environment.Id)

	return nil
}
