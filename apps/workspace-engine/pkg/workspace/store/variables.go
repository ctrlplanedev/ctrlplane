package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/repository"
)

type Variables struct {
	repo  *repository.InMemoryStore
	store *Store
}

func NewVariables(store *Store) *Variables {
	return &Variables{repo: store.repo, store: store}
}

// ResolveValue resolves a value, accepting optional pre-computed related entities for performance.
// Pass nil for entities to fetch them on-demand.
func (v *Variables) ResolveValue(
	ctx context.Context,
	entity *oapi.RelatableEntity,
	value *oapi.Value,
	entities map[string][]*oapi.EntityRelation,
) (*oapi.LiteralValue, error) {


	valueType, err := value.GetType()
	if err != nil {
		return nil, err
	}
	switch valueType {
	case "literal":
		lv, err := value.AsLiteralValue()
		if err != nil {
			return nil, err
		}
		return &lv, nil
	case "reference":
		rv, err := value.AsReferenceValue()
		if err != nil {
			return nil, err
		}

		if entities == nil {
			entities, _ = v.store.Relationships.GetRelatedEntities(ctx, entity)
		}

		refEntities := entities[rv.Reference]
		if len(refEntities) == 0 {
			return nil, fmt.Errorf("reference not found: %v for entity: %v-%v", rv.Reference, entity.GetType(), entity.GetID())
		}

		computeEntityRelationship := refEntities[0]
		literalValue, err := relationships.GetPropertyValue(&computeEntityRelationship.Entity, rv.Path)
		if err != nil {
			return nil, err
		}

		return literalValue, nil
	}
	return nil, fmt.Errorf("unsupported variable type: %T", value)
}

