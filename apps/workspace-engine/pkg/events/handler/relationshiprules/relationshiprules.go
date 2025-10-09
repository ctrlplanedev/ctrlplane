package relationshiprules

import (
	"context"
	"errors"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleRelationshipRuleCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	relationshipRule := &pb.RelationshipRule{}
	if err := protojson.Unmarshal(event.Data, relationshipRule); err != nil {
		return err
	}

	if event.WorkspaceID != ws.ID {
		return errors.New("relationship rule workspace id does not match workspace id")
	}

	return ws.RelationshipRules().Upsert(ctx, relationshipRule)
}

func HandleRelationshipRuleUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	relationshipRule := &pb.RelationshipRule{}
	if err := protojson.Unmarshal(event.Data, relationshipRule); err != nil {
		return err
	}

	return ws.RelationshipRules().Upsert(ctx, relationshipRule)
}

func HandleRelationshipRuleDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	relationshipRule := &pb.RelationshipRule{}
	if err := protojson.Unmarshal(event.Data, relationshipRule); err != nil {
		return err
	}

	ws.RelationshipRules().Remove(relationshipRule.Id)
	return nil
}
