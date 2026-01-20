package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewPolicies(store *Store) *Policies {
	return &Policies{
		repo:  store.repo,
		store: store,
	}
}

type Policies struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (p *Policies) Items() map[string]*oapi.Policy {
	return p.repo.Policies.Items()
}

func (p *Policies) Get(id string) (*oapi.Policy, bool) {
	return p.repo.Policies.Get(id)
}

func (p *Policies) Upsert(ctx context.Context, policy *oapi.Policy) {
	if policy.Metadata == nil {
		policy.Metadata = make(map[string]string)
	}

	if policy.CreatedAt == "" {
		policy.CreatedAt = time.Now().Format(time.RFC3339)
	}

	for _, rule := range policy.Rules {
		if rule.PolicyId == "" {
			rule.PolicyId = policy.Id
		}

		if rule.CreatedAt == "" {
			rule.CreatedAt = policy.CreatedAt
		}
	}

	p.repo.Policies.Set(policy.Id, policy)
	p.store.changeset.RecordUpsert(policy)
}

func (p *Policies) Remove(ctx context.Context, id string) {
	policy, ok := p.repo.Policies.Get(id)
	if !ok || policy == nil {
		return
	}

	p.repo.Policies.Remove(id)
	p.store.changeset.RecordDelete(policy)
}
