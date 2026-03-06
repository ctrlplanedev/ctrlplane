package events

import (
	"context"
	"fmt"
	"workspace-engine/pkg/reconcile"

	"github.com/charmbracelet/log"
)

const PolicySummaryKind = "policy-summary"

const (
	PolicySummaryScopeEnvironment        = "environment"
	PolicySummaryScopeEnvironmentVersion = "environment-version"
	PolicySummaryScopeDeploymentVersion  = "deployment-version"
)

type PolicySummaryParams struct {
	WorkspaceID string
	ScopeType   string
	ScopeID     string
}

type EnvironmentSummaryParams struct {
	WorkspaceID   string
	EnvironmentID string
}

func (p EnvironmentSummaryParams) ToParams() PolicySummaryParams {
	return PolicySummaryParams{
		WorkspaceID: p.WorkspaceID,
		ScopeType:   PolicySummaryScopeEnvironment,
		ScopeID:     p.EnvironmentID,
	}
}

type EnvironmentVersionSummaryParams struct {
	WorkspaceID   string
	EnvironmentID string
	VersionID     string
}

func (p EnvironmentVersionSummaryParams) ScopeID() string {
	return fmt.Sprintf("%s:%s", p.EnvironmentID, p.VersionID)
}

func (p EnvironmentVersionSummaryParams) ToParams() PolicySummaryParams {
	return PolicySummaryParams{
		WorkspaceID: p.WorkspaceID,
		ScopeType:   PolicySummaryScopeEnvironmentVersion,
		ScopeID:     p.ScopeID(),
	}
}

type DeploymentVersionSummaryParams struct {
	WorkspaceID  string
	DeploymentID string
	VersionID    string
}

func (p DeploymentVersionSummaryParams) ScopeID() string {
	return fmt.Sprintf("%s:%s", p.DeploymentID, p.VersionID)
}

func (p DeploymentVersionSummaryParams) ToParams() PolicySummaryParams {
	return PolicySummaryParams{
		WorkspaceID: p.WorkspaceID,
		ScopeType:   PolicySummaryScopeDeploymentVersion,
		ScopeID:     p.ScopeID(),
	}
}

func EnqueuePolicySummary(queue reconcile.Queue, ctx context.Context, params PolicySummaryParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        PolicySummaryKind,
		ScopeType:   params.ScopeType,
		ScopeID:     params.ScopeID,
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
			ScopeType:   p.ScopeType,
			ScopeID:     p.ScopeID,
		}
	}
	return queue.EnqueueMany(ctx, items)
}
