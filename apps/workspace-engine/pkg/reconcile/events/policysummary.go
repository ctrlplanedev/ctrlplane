package events

import (
	"context"
	"fmt"
	"workspace-engine/pkg/reconcile"

	"github.com/charmbracelet/log"
)

const PolicySummaryKind = "policy-summary"

type PolicySummaryParams struct {
	WorkspaceID   string
	EnvironmentID string
	VersionID     string
}

func (p PolicySummaryParams) ScopeID() string {
	return fmt.Sprintf("%s:%s", p.EnvironmentID, p.VersionID)
}

func EnqueuePolicySummary(queue reconcile.Queue, ctx context.Context, params PolicySummaryParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        PolicySummaryKind,
		ScopeType:   "environment-version",
		ScopeID:     params.ScopeID(),
	})
}

func EnqueueManyPolicySummary(queue reconcile.Queue, ctx context.Context, params []PolicySummaryParams) error {
	if len(params) == 0 {
		return nil
	}
	log.Info("enqueueing policy summary", "count", len(params))
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        PolicySummaryKind,
			ScopeType:   "environment-version",
			ScopeID:     p.ScopeID(),
		}
	}
	return queue.EnqueueMany(ctx, items)
}
