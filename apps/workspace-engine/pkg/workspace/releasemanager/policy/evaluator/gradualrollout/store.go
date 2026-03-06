package gradualrollout

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/store"
)

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	approvalGetters
	environmentProgressionGetters
	store *store.Store
}

func NewStoreGetters(store *store.Store) *storeGetters {
	return &storeGetters{
		store:                         store,
		approvalGetters:               approval.NewStoreGetters(store),
		environmentProgressionGetters: environmentprogression.NewStoreGetters(store),
	}
}

// GetPoliciesForTarget implements [Getters].
func (s *storeGetters) GetPoliciesForTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
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
