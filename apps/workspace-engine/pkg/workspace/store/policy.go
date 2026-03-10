package store

import (
	"context"
	"time"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

var policiesTracer = otel.Tracer("workspace/store/policies")

func NewPolicies(store *Store) *Policies {
	return &Policies{
		repo:  store.repo.Policies(),
		store: store,
	}
}

type Policies struct {
	repo  repository.PolicyRepo
	store *Store
}

func (p *Policies) SetRepo(repo repository.PolicyRepo) {
	p.repo = repo
}

func (p *Policies) Items() map[string]*oapi.Policy {
	return p.repo.Items()
}

func (p *Policies) Get(id string) (*oapi.Policy, bool) {
	return p.repo.Get(id)
}

func (p *Policies) Upsert(ctx context.Context, policy *oapi.Policy) {
	_, span := policiesTracer.Start(ctx, "UpsertPolicy")
	defer span.End()

	if policy.Metadata == nil {
		policy.Metadata = make(map[string]string)
	}

	if policy.CreatedAt == "" {
		policy.CreatedAt = time.Now().Format(time.RFC3339)
	}

	for i := range policy.Rules {
		if policy.Rules[i].PolicyId == "" {
			policy.Rules[i].PolicyId = policy.Id
		}
		if policy.Rules[i].CreatedAt == "" {
			policy.Rules[i].CreatedAt = policy.CreatedAt
		}
	}

	if err := p.repo.Set(policy); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert policy")
		log.Error("Failed to upsert policy", "error", err)
		return
	}
	p.store.changeset.RecordUpsert(policy)
}

func (p *Policies) Remove(ctx context.Context, id string) {
	policy, ok := p.repo.Get(id)
	if !ok || policy == nil {
		return
	}

	if err := p.repo.Remove(id); err != nil {
		log.Error("Failed to remove policy", "error", err)
		return
	}
	p.store.changeset.RecordDelete(policy)
}
