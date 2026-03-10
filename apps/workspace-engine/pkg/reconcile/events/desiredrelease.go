package events

import (
	"context"
	"fmt"

	"github.com/charmbracelet/log"
	"workspace-engine/pkg/reconcile"
)

const DesiredReleaseKind = "desired-release"

type DesiredReleaseEvalParams struct {
	WorkspaceID   string
	ResourceID    string
	EnvironmentID string
	DeploymentID  string
}

func (params DesiredReleaseEvalParams) ScopeID() string {
	return fmt.Sprintf("%s:%s:%s", params.DeploymentID, params.EnvironmentID, params.ResourceID)
}

func EnqueueDesiredRelease(
	queue reconcile.Queue,
	ctx context.Context,
	params DesiredReleaseEvalParams,
) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        DesiredReleaseKind,
		ScopeType:   "release-target",
		ScopeID:     params.ScopeID(),
	})
}

func EnqueueManyDesiredRelease(
	queue reconcile.Queue,
	ctx context.Context,
	params []DesiredReleaseEvalParams,
) error {
	if len(params) == 0 {
		return nil
	}
	log.Info("enqueueing desired release", "count", len(params))
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        DesiredReleaseKind,
			ScopeType:   "release-target",
			ScopeID:     p.ScopeID(),
		}
	}
	return queue.EnqueueMany(ctx, items)
}
