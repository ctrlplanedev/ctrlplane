package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type PolicyGetter interface {
	GetAllPolicies() (map[string]*oapi.Policy, error)
	GetPolicy(id string) (*oapi.Policy, error)
	GetPolicyForReleaseTarget(releaseTarget *oapi.ReleaseTarget) (*oapi.Policy, error)
}

type Policies struct {
	store *store.Store
}

func NewPolicies(store *store.Store) *Policies {
	return &Policies{store: store}
}

func (p *Policies) GetAllPolicies() (map[string]*oapi.Policy, error) {
	return p.store.Policies.Items(), nil
}

func (p *Policies) GetPolicy(id string) (*oapi.Policy, error) {
	v, ok := p.store.Policies.Get(id)
	if !ok {
		return nil, fmt.Errorf("policy %s not found", id)
	}
	return v, nil
}

func (p *Policies) GetPolicyForReleaseTarget(releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	policies, err := p.store.ReleaseTargets.GetPolicies(context.Background(), releaseTarget)
	if err != nil {
		return nil, fmt.Errorf("get policies for release target: %w", err)
	}
	if len(policies) == 0 {
		return nil, fmt.Errorf("no policies found for release target")
	}
	return policies, nil
}
