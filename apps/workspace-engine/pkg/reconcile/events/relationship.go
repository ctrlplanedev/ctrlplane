package events

import (
	"context"
	"workspace-engine/pkg/reconcile"
)

const RelationshipEvalKind = "relationship-eval"

type RelationshipEvalParams struct {
	WorkspaceID string
	EntityType  string // "resource", "deployment", or "environment"
	EntityID    string
}

func EnqueueRelationshipEval(queue reconcile.Queue, ctx context.Context, params RelationshipEvalParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        RelationshipEvalKind,
		ScopeType:   "entity",
		ScopeID:     params.EntityType + ":" + params.EntityID,
	})
}

func EnqueueManyRelationshipEval(queue reconcile.Queue, ctx context.Context, params []RelationshipEvalParams) error {
	if len(params) == 0 {
		return nil
	}
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        RelationshipEvalKind,
			ScopeType:   "entity",
			ScopeID:     p.EntityType + ":" + p.EntityID,
		}
	}
	return queue.EnqueueMany(ctx, items)
}
