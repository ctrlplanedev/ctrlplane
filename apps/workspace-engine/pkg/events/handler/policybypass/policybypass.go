package policybypass

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandlePolicyBypassCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	bypass := &oapi.PolicyBypass{}
	if err := json.Unmarshal(event.Data, bypass); err != nil {
		return err
	}

	ws.Store().PolicyBypasses.Upsert(ctx, bypass)
	return nil
}

func HandlePolicyBypassDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	bypass := &oapi.PolicyBypass{}
	if err := json.Unmarshal(event.Data, bypass); err != nil {
		return err
	}

	ws.Store().PolicyBypasses.Remove(ctx, bypass.Id)
	return nil
}
