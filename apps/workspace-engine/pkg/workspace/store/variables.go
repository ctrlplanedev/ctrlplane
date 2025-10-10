package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/repository"
)

type Variables struct {
	repo  *repository.Repository
	store *Store
}

func NewVariables(store *Store) *Variables {
	return &Variables{repo: store.repo, store: store}
}

func (v *Variables) ResolveValue(ctx context.Context, entity *relationships.Entity, value *oapi.Value) (*oapi.LiteralValue, error) {
	if lv, err := value.AsLiteralValue(); err == nil {
		return &lv, nil
	}

	if rv, err := value.AsReferenceValue(); err == nil {
		references, _ := v.store.Relationships.GetRelatedEntities(ctx, entity)
		if references == nil {
			return nil, fmt.Errorf("references not found: %v", rv.Reference)
		}
		refEntities := references[rv.Reference]
		if len(refEntities) == 0 {
			return nil, fmt.Errorf("reference not found: %v", rv.Reference)
		}

		refEntity := refEntities[0]
		value, err := relationships.GetPropertyValue(refEntity.Item(), rv.Path)
		if err != nil {
			return nil, err
		}

		return value, nil
	}

	return nil, fmt.Errorf("unsupported variable type: %T", value)
}
