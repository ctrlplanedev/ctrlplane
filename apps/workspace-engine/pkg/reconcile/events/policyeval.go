package events

import (
	"context"

	"github.com/charmbracelet/log"
	"workspace-engine/pkg/reconcile"
)

const PolicyEvalKind = "policy-eval"

type PolicyEvalParams struct {
	WorkspaceID string
	VersionID   string
}

func EnqueuePolicyEval(
	queue reconcile.Queue,
	ctx context.Context,
	params PolicyEvalParams,
) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        PolicyEvalKind,
		ScopeType:   "deployment-version",
		ScopeID:     params.VersionID,
	})
}

func EnqueueManyPolicyEval(
	queue reconcile.Queue,
	ctx context.Context,
	params []PolicyEvalParams,
) error {
	if len(params) == 0 {
		return nil
	}
	log.Info("enqueueing policy eval", "count", len(params))
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        PolicyEvalKind,
			ScopeType:   "deployment-version",
			ScopeID:     p.VersionID,
		}
	}
	return queue.EnqueueMany(ctx, items)
}
