package environment

import (
	"context"
	"encoding/json"
	"errors"
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
	if err := json.Unmarshal(event.Data, environment); err != nil {
		var payload struct {
			New *pb.Environment `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' environment in update event")
		}
		environment = payload.New
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
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	ws.Environments().Remove(ctx, environment.Id)
	ws.ReleaseManager().TaintEnvironmentsReleaseTargets(environment.Id)

	return nil
}
