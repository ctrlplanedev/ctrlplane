package policies

import (
	"context"
	"encoding/json"
	"errors"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandlePolicyCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &pb.Policy{}
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
	policy := &pb.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		var payload struct {
			New *pb.Policy `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' policy in update event")
		}
		policy = payload.New
	}

	ws.Policies().Upsert(ctx, policy)
	
	return nil
}

func HandlePolicyDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &pb.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	ws.Policies().Remove(policy.Id)

	return nil
}
