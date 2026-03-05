package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
)

var relationshipRulesTracer = otel.Tracer("workspace/store/relationship_rules")

func NewRelationshipRules(store *Store) *RelationshipRules {
	return &RelationshipRules{
		repo:  store.repo.RelationshipRulesRepo(),
		store: store,
	}
}

type RelationshipRules struct {
	repo  repository.RelationshipRuleRepo
	store *Store
}

func (r *RelationshipRules) SetRepo(repo repository.RelationshipRuleRepo) {
	r.repo = repo
}

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	_, span := relationshipRulesTracer.Start(ctx, "UpsertRelationshipRule")
	defer span.End()

	if err := r.repo.Set(relationship); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert relationship rule")
		log.Error("Failed to upsert relationship rule", "error", err)
		return err
	}
	r.store.changeset.RecordUpsert(relationship)

	return nil
}

func (r *RelationshipRules) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.repo.Get(id)
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) error {
	relationship, ok := r.repo.Get(id)
	if !ok || relationship == nil {
		return nil
	}

	if err := r.repo.Remove(id); err != nil {
		log.Error("Failed to remove relationship rule", "error", err)
		return err
	}
	r.store.changeset.RecordDelete(relationship)

	return nil
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.Items()
}

func (r *RelationshipRules) GetRelatedEntities(ctx context.Context, entity *oapi.RelatableEntity) (map[string][]*oapi.EntityRelation, error) {
	return r.store.RelationshipIndexes.GetRelatedEntities(ctx, entity)
}
