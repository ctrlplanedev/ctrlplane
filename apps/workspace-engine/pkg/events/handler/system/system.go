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

	ws.Systems().Upsert(ctx, system)
	ws.ReleaseManager().TaintAllReleaseTargets()

	return nil
}

func HandleSystemUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &raw); err != nil {
		return err
	}

	system := &pb.System{}
	if currentData, exists := raw["current"]; exists {
		// Parse as nested structure with "current" field
		if err := json.Unmarshal(currentData, system); err != nil {
			return err
		}
	} else {
		// Parse directly as userApprovalRecord
		if err := json.Unmarshal(event.Data, system); err != nil {
			return err
		}
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
