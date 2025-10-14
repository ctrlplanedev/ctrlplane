package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewPolicies(store *Store) *Policies {
	return &Policies{
		repo:           store.repo,
		store:          store,
	}
}

type Policies struct {
	repo           *repository.Repository
	store          *Store
}

func (p *Policies) Items() map[string]*oapi.Policy {
	return p.repo.Policies.Items()
}

func (p *Policies) IterBuffered() <-chan cmap.Tuple[string, *oapi.Policy] {
	return p.repo.Policies.IterBuffered()
}

func (p *Policies) Get(id string) (*oapi.Policy, bool) {
	return p.repo.Policies.Get(id)
}

func (p *Policies) Has(id string) bool {
	return p.repo.Policies.Has(id)
}

func (p *Policies) Upsert(ctx context.Context, policy *oapi.Policy) error {
	p.repo.Policies.Set(policy.Id, policy)
	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("policy", changeset.ChangeTypeInsert, policy.Id, policy)
	}
	return nil
}

func (p *Policies) Remove(ctx context.Context, id string) {
	p.repo.Policies.Remove(id)
	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("policy", changeset.ChangeTypeDelete, id, nil)
	}
}
