package gradualrollout

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetPolicies(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error)
	GetPolicySkips(versionID, environmentID, resourceID string) []*oapi.PolicySkip
	HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) bool
	GetResource(resourceID string) (*oapi.Resource, bool)
	GetDeployment(deploymentID string) (*oapi.Deployment, bool)
	GetReleaseTargets() ([]*oapi.ReleaseTarget, error)
	NewApprovalEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator
	NewEnvironmentProgressionEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator
	NewGradualRolloutEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) GetPolicies(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	return s.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
}

func (s *storeGetters) GetPolicySkips(versionID, environmentID, resourceID string) []*oapi.PolicySkip {
	return s.store.PolicySkips.GetAllForTarget(versionID, environmentID, resourceID)
}

func (s *storeGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) bool {
	_, _, err := s.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	return err == nil
}

func (s *storeGetters) GetResource(resourceID string) (*oapi.Resource, bool) {
	return s.store.Resources.Get(resourceID)
}

func (s *storeGetters) GetDeployment(deploymentID string) (*oapi.Deployment, bool) {
	return s.store.Deployments.Get(deploymentID)
}

func (s *storeGetters) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
	items, err := s.store.ReleaseTargets.Items()
	if err != nil {
		return nil, err
	}
	targets := make([]*oapi.ReleaseTarget, 0, len(items))
	for _, rt := range items {
		targets = append(targets, rt)
	}
	return targets, nil
}

func (s *storeGetters) NewApprovalEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return approval.NewEvaluatorFromStore(s.store, rule)
}

func (s *storeGetters) NewEnvironmentProgressionEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return environmentprogression.NewEvaluatorFromStore(s.store, rule)
}

func (s *storeGetters) NewGradualRolloutEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return NewEvaluatorFromStore(s.store, rule)
}
