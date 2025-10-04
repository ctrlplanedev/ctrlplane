package store

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewPolicies(store *Store) *Policies {
	return &Policies{
		repo: store.repo,
	}
}

type Policies struct {
	repo *repository.Repository
}

func (p *Policies) IterBuffered() <-chan cmap.Tuple[string, *pb.Policy] {
	return p.repo.Policies.IterBuffered()
}

func (p *Policies) Get(id string) (*pb.Policy, bool) {
	return p.repo.Policies.Get(id)
}

func (p *Policies) Has(id string) bool {
	return p.repo.Policies.Has(id)
}

func (p *Policies) Upsert(ctx context.Context, policy *pb.Policy) error {
	p.repo.Policies.Set(policy.Id, policy)
	return nil
}

func (p *Policies) Remove(id string) {
	p.repo.Policies.Remove(id)
}

func (p *Policies) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *pb.ReleaseTarget) []*pb.Policy {
	return []*pb.Policy{}
}