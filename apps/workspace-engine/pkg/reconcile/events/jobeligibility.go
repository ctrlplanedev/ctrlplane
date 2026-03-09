package events

import (
	"context"
	"fmt"
	"workspace-engine/pkg/reconcile"

	"github.com/charmbracelet/log"
)

const JobEligibilityKind = "job-eligibility"

type JobEligibilityParams struct {
	WorkspaceID   string
	ResourceID    string
	EnvironmentID string
	DeploymentID  string
}

func (params JobEligibilityParams) ScopeID() string {
	return fmt.Sprintf("%s:%s:%s", params.DeploymentID, params.EnvironmentID, params.ResourceID)
}

func EnqueueJobEligibility(queue reconcile.Queue, ctx context.Context, params JobEligibilityParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        JobEligibilityKind,
		ScopeType:   "release-target",
		ScopeID:     params.ScopeID(),
	})
}

func EnqueueManyJobEligibility(queue reconcile.Queue, ctx context.Context, params []JobEligibilityParams) error {
	if len(params) == 0 {
		return nil
	}
	log.Info("enqueueing job eligibility", "count", len(params))
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        JobEligibilityKind,
			ScopeType:   "release-target",
			ScopeID:     p.ScopeID(),
		}
	}
	return queue.EnqueueMany(ctx, items)
}
