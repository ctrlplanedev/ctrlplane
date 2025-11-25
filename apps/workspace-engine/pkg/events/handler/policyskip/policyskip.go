package policyskip

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandlePolicySkipCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	bypass := &oapi.PolicySkip{}
	if err := json.Unmarshal(event.Data, bypass); err != nil {
		return err
	}

	ws.Store().PolicySkips.Upsert(ctx, bypass)
	return nil
}

func HandlePolicySkipDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	bypass := &oapi.PolicySkip{}
	if err := json.Unmarshal(event.Data, bypass); err != nil {
		return err
	}

	ws.Store().PolicySkips.Remove(ctx, bypass.Id)
	return nil
}
