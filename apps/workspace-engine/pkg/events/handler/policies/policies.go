package policies

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandlePolicyCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &pb.Policy{}
	if err := protojson.Unmarshal(event.Data, policy); err != nil {
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
	if err := protojson.Unmarshal(event.Data, policy); err != nil {
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
	policy := &pb.Policy{}
	if err := protojson.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	ws.Policies().Remove(policy.Id)

	return nil
}
