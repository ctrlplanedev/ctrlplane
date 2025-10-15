package environment

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandleEnvironmentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &oapi.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	if err := ws.Environments().Upsert(ctx, environment); err != nil {
		return err
	}

	return nil
}

func HandleEnvironmentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &oapi.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	if err := ws.Environments().Upsert(ctx, environment); err != nil {
		return err
	}

	return nil
}

func HandleEnvironmentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &oapi.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	ws.Environments().Remove(ctx, environment.Id)

	return nil
}
