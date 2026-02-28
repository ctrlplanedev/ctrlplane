package harness

import (
	"context"
	"sync"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/desiredrelease"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// deploymentresourceselectoreval mocks
// ---------------------------------------------------------------------------

// SelectorEvalGetter implements deploymentresourceselectoreval.Getter.
type SelectorEvalGetter struct {
	Deployment     *selectoreval.DeploymentInfo
	Resources      []selectoreval.ResourceInfo
	ReleaseTargets []selectoreval.ReleaseTarget
}

func (g *SelectorEvalGetter) GetDeploymentInfo(_ context.Context, _ uuid.UUID) (*selectoreval.DeploymentInfo, error) {
	return g.Deployment, nil
}

func (g *SelectorEvalGetter) StreamResources(_ context.Context, _ uuid.UUID, _ int, batches chan<- []selectoreval.ResourceInfo) error {
	defer close(batches)
	if len(g.Resources) > 0 {
		batches <- g.Resources
	}
	return nil
}

func (g *SelectorEvalGetter) GetReleaseTargetsForDeployment(_ context.Context, _ uuid.UUID) ([]selectoreval.ReleaseTarget, error) {
	return g.ReleaseTargets, nil
}

// SelectorEvalSetter implements deploymentresourceselectoreval.Setter.
type SelectorEvalSetter struct {
	mu                sync.Mutex
	ComputedResources []uuid.UUID
}

func (s *SelectorEvalSetter) SetComputedDeploymentResources(_ context.Context, _ uuid.UUID, ids []uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ComputedResources = ids
	return nil
}

// ---------------------------------------------------------------------------
// desiredrelease mocks
// ---------------------------------------------------------------------------

// DesiredReleaseGetter implements desiredrelease.Getter.
type DesiredReleaseGetter struct {
	mu sync.Mutex

	Scope           *evaluator.EvaluatorScope
	Versions        []*oapi.DeploymentVersion
	Policies        []*oapi.Policy
	ApprovalRecords []*oapi.UserApprovalRecord
	HasRelease      bool
	CurrentRelease  *oapi.Release

	// ApprovalRecordsFn allows per-version/per-environment logic when set.
	ApprovalRecordsFn func(versionID, environmentID string) []*oapi.UserApprovalRecord
}

func (g *DesiredReleaseGetter) ReleaseTargetExists(_ context.Context, _ *desiredrelease.ReleaseTarget) (bool, error) {
	return true, nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetScope(_ context.Context, _ *desiredrelease.ReleaseTarget) (*evaluator.EvaluatorScope, error) {
	return g.Scope, nil
}

func (g *DesiredReleaseGetter) GetCandidateVersions(_ context.Context, _ uuid.UUID) ([]*oapi.DeploymentVersion, error) {
	return g.Versions, nil
}

func (g *DesiredReleaseGetter) GetPolicies(_ context.Context, _ *desiredrelease.ReleaseTarget) ([]*oapi.Policy, error) {
	return g.Policies, nil
}

func (g *DesiredReleaseGetter) GetApprovalRecords(_ context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	if g.ApprovalRecordsFn != nil {
		return g.ApprovalRecordsFn(versionID, environmentID), nil
	}
	return g.ApprovalRecords, nil
}

func (g *DesiredReleaseGetter) HasCurrentRelease(_ context.Context, _ *desiredrelease.ReleaseTarget) (bool, error) {
	return g.HasRelease, nil
}

func (g *DesiredReleaseGetter) GetCurrentRelease(_ context.Context, _ *desiredrelease.ReleaseTarget) (*oapi.Release, error) {
	return g.CurrentRelease, nil
}

func (g *DesiredReleaseGetter) GetPolicySkips(_ context.Context, _, _, _ string) ([]*oapi.PolicySkip, error) {
	return nil, nil
}

// DesiredReleaseSetter implements desiredrelease.Setter.
type DesiredReleaseSetter struct {
	mu        sync.Mutex
	Releases  []*oapi.Release
	CallCount int
}

func (s *DesiredReleaseSetter) SetDesiredRelease(_ context.Context, _ *desiredrelease.ReleaseTarget, r *oapi.Release) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.CallCount++
	s.Releases = append(s.Releases, r)
	return nil
}
