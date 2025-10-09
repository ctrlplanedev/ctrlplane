package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
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

func (v *Variables) ResolveValue(ctx context.Context, entity any, value *pb.Value) (*pb.LiteralValue, error) {
	switch value.Data.(type) {
	case *pb.Value_Literal:
		literal := value.GetLiteral()
		return literal, nil
	case *pb.Value_Reference:
		referenceVariable := value.GetReference()

		references := v.store.Relationships.GetRelations(ctx, entity)
		refEntities := references[referenceVariable.Reference]
		if len(refEntities) == 0 {
			return nil, fmt.Errorf("reference not found: %v", referenceVariable.Reference)
		}

		refEntity := refEntities[0]
		value, err := relationships.GetPropertyValue(refEntity, referenceVariable.Path)
		if err != nil {
			return nil, err
		}

		return value, nil
	case *pb.Value_Sensitive:
		sensitive := value.GetSensitive()
		return nil, fmt.Errorf("sensitive not supported: %v", sensitive)
	}
	return nil, fmt.Errorf("unsupported variable type: %T", value.Data)
}
