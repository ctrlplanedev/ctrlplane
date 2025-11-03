package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

type Variables struct {
	repo  *repository.InMemoryStore
	store *Store
}

func NewVariables(store *Store) *Variables {
	return &Variables{repo: store.repo, store: store}
}

func (v *Variables) ResolveValue(ctx context.Context, entity *oapi.RelatableEntity, value *oapi.Value) (*oapi.LiteralValue, error) {
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
		references, _ := v.store.Relationships.GetRelatedEntities(ctx, entity)
		if references == nil {
			return nil, fmt.Errorf("references nil - not found: %v for entity: %v-%v", rv.Reference, entity.GetType(), entity.GetID())
		}
		for _, reference := range references {
			for _, relation := range reference {
				log.Info("===== relation ======", "relation", relation.Rule.Description, "relation", relation.Rule.Name)
				log.Info("===== relation metadata ======", "relation", relation.Direction)
			}
		}
		refEntities := references[rv.Reference]
		log.Info("===== reference entities ======", "reference", rv.Reference, "refEntities", len(refEntities))
		if len(refEntities) == 0 {
			return nil, fmt.Errorf("reference not found: %v for entity: %v-%v", rv.Reference, entity.GetType(), entity.GetID())
		}

		computeEntityRelationship := refEntities[0]
		value, err := relationships.GetPropertyValue(&computeEntityRelationship.Entity, rv.Path)
		if err != nil {
			return nil, err
		}

		return value, nil
	}
	return nil, fmt.Errorf("unsupported variable type: %T", value)
}
