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
	skip := &oapi.PolicySkip{}
	if err := json.Unmarshal(event.Data, skip); err != nil {
		return err
	}

	ws.Store().PolicySkips.Upsert(ctx, skip)
	return nil
}

func HandlePolicySkipDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	skip := &oapi.PolicySkip{}
	if err := json.Unmarshal(event.Data, skip); err != nil {
		return err
	}

	ws.Store().PolicySkips.Remove(ctx, skip.Id)
	return nil
}
