package variableresolver

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/codes"
)

// relatedLookup resolves a reference name to matched related entities.
type relatedLookup func(ctx context.Context, reference string) (*eval.EntityData, error)

// resolveValue resolves a single oapi.Value to a concrete LiteralValue.
//
// Literal values are returned as-is. Reference values are resolved by
// finding related entities through the lookup and traversing the property
// path on the matched entity's raw data. Sensitive values return an error.
func resolveValue(
	ctx context.Context,
	lookup relatedLookup,
	value *oapi.Value,
) *oapi.LiteralValue {
	_, span := tracer.Start(ctx, "variableresolver.resolveValue")
	defer span.End()

	valueType, err := value.GetType()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get value type failed")
		log.Error("get value type failed", "error", err)
		return nil
	}

	switch valueType {
	case "literal":
		lv, err := value.AsLiteralValue()
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "extract literal value failed")
			log.Error("extract literal value failed", "error", err)
			return nil
		}
		return &lv
	case "reference":
		lv, err := resolveReference(ctx, lookup, value)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "resolve reference failed")
			log.Error("resolve reference failed", "error", err)
			return nil
		}
		return lv
	case "sensitive":
		return nil
	default:
		return nil
	}
}

func resolveReference(
	ctx context.Context,
	lookup relatedLookup,
	value *oapi.Value,
) (*oapi.LiteralValue, error) {
	rv, err := value.AsReferenceValue()
	if err != nil {
		return nil, fmt.Errorf("extract reference value: %w", err)
	}

	entity, err := lookup(ctx, rv.Reference)
	if err != nil {
		return nil, fmt.Errorf("resolve related for reference %q: %w", rv.Reference, err)
	}
	if entity == nil {
		return nil, nil
	}
	return getMapProperty(entity.Raw, rv.Path)
}
