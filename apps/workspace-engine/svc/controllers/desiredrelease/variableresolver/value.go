package variableresolver

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
)

// ResolveValue resolves a single oapi.Value to a concrete LiteralValue.
//
// Literal values are returned as-is. Reference values are resolved by fetching
// the specific named relationship via the getter and traversing the property
// path on the matched entity. Sensitive values are not resolved and return an
// error — they must be handled by a separate decryption path.
func ResolveValue(
	ctx context.Context,
	getter Getter,
	resourceID string,
	entity *oapi.RelatableEntity,
	value *oapi.Value,
) (*oapi.LiteralValue, error) {
	_, span := tracer.Start(ctx, "variableresolver.ResolveValue")
	defer span.End()

	valueType, err := value.GetType()
	if err != nil {
		return nil, fmt.Errorf("determine value type: %w", err)
	}

	switch valueType {
	case "literal":
		return resolveLiteral(value)
	case "reference":
		return resolveReference(ctx, getter, resourceID, value, entity)
	case "sensitive":
		return nil, fmt.Errorf("sensitive values are not resolved by the variable resolver")
	default:
		return nil, fmt.Errorf("unsupported value type: %s", valueType)
	}
}

func resolveLiteral(value *oapi.Value) (*oapi.LiteralValue, error) {
	lv, err := value.AsLiteralValue()
	if err != nil {
		return nil, fmt.Errorf("extract literal value: %w", err)
	}
	return &lv, nil
}

func resolveReference(
	ctx context.Context,
	getter Getter,
	resourceID string,
	value *oapi.Value,
	entity *oapi.RelatableEntity,
) (*oapi.LiteralValue, error) {
	rv, err := value.AsReferenceValue()
	if err != nil {
		return nil, fmt.Errorf("extract reference value: %w", err)
	}

	refs, err := getter.GetRelatedEntity(ctx, resourceID, rv.Reference)
	if err != nil {
		return nil, fmt.Errorf("get related entity for reference %q: %w", rv.Reference, err)
	}
	if len(refs) == 0 {
		return nil, fmt.Errorf(
			"reference %q not found for entity %s-%s",
			rv.Reference, entity.GetType(), entity.GetID(),
		)
	}

	lv, err := relationships.GetPropertyValue(&refs[0].Entity, rv.Path)
	if err != nil {
		return nil, fmt.Errorf("resolve property path %v on reference %q: %w", rv.Path, rv.Reference, err)
	}
	return lv, nil
}
