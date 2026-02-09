package relationshiprules

import (
	"context"
	"encoding/json"
	"errors"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandleRelationshipRuleCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	relationshipRule := &oapi.RelationshipRule{}
	if err := json.Unmarshal(event.Data, relationshipRule); err != nil {
		return err
	}

	if event.WorkspaceID != ws.ID {
		return errors.New("relationship rule workspace id does not match workspace id")
	}

	if err := ws.RelationshipRules().Upsert(ctx, relationshipRule); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.AddRule(ctx, relationshipRule)

	return nil
}

func HandleRelationshipRuleUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	relationshipRule := &oapi.RelationshipRule{}
	if err := json.Unmarshal(event.Data, relationshipRule); err != nil {
		return err
	}

	if err := ws.RelationshipRules().Upsert(ctx, relationshipRule); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.UpdateRule(ctx, relationshipRule)

	return nil
}

func HandleRelationshipRuleDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	relationshipRule := &oapi.RelationshipRule{}
	if err := json.Unmarshal(event.Data, relationshipRule); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.RemoveRule(relationshipRule.Id)
	_ = ws.RelationshipRules().Remove(ctx, relationshipRule.Id)

	return nil
}
