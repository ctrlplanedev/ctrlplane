package policies

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandlePolicyCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &oapi.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	ws.Policies().Upsert(ctx, policy)

	return nil
}

func HandlePolicyUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &oapi.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	ws.Policies().Upsert(ctx, policy)

	return nil
}

func HandlePolicyDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &oapi.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	ws.Policies().Remove(policy.Id)

	return nil
}
