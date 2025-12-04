package relationshiprules

import (
	"context"
	"errors"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships/compute"

	"encoding/json"
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

	entities := ws.Relations().GetRelatableEntities(ctx)
	relations, err := compute.FindRuleRelationships(ctx, relationshipRule, entities)
	if err != nil {
		return err
	}
	for _, relation := range relations {
		_ = ws.Relations().Upsert(ctx, relation)
	}

	return ws.RelationshipRules().Upsert(ctx, relationshipRule)
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

	entities := ws.Relations().GetRelatableEntities(ctx)
	oldRelations := ws.Relations().ForRule(relationshipRule)
	newRelations, err := compute.FindRuleRelationships(ctx, relationshipRule, entities)
	if err != nil {
		return err
	}
	removedRelations := compute.FindRemovedRelations(ctx, oldRelations, newRelations)
	for _, relation := range newRelations {
		_ = ws.Relations().Upsert(ctx, relation)
	}
	for _, relation := range removedRelations {
		ws.Relations().Remove(relation.Key())
	}

	return ws.RelationshipRules().Upsert(ctx, relationshipRule)
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

	for _, relation := range ws.Relations().Items() {
		if relation.Rule.Id == relationshipRule.Id {
			ws.Relations().Remove(relation.Key())
		}
	}

	_ = ws.RelationshipRules().Remove(ctx, relationshipRule.Id)

	return nil
}
