package selector

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("selector")

type Selector any

func FilterResources(ctx context.Context, unknownCondition unknown.UnknownCondition, resources []*pb.Resource) ([]*pb.Resource, error) {
	ctx, span := tracer.Start(ctx, "FilterResources")
	defer span.End()

	span.SetAttributes(attribute.String("selector.type", unknownCondition.Property))
	span.SetAttributes(attribute.String("selector.operator", unknownCondition.Operator))
	span.SetAttributes(attribute.String("selector.value", unknownCondition.Value))
	span.SetAttributes(attribute.String("selector.metadata_key", unknownCondition.MetadataKey))
	span.SetAttributes(attribute.Int("selector.conditions", len(unknownCondition.Conditions)))
	span.SetAttributes(attribute.Int("resources.input", len(resources)))

	selector, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return []*pb.Resource{}, err
	}

	// Pre-allocate with reasonable capacity (assume ~50% match rate to minimize reallocations)
	// This avoids multiple slice reallocations during append
	estimatedCapacity := max(len(resources) / 2, 128)
	matchedResources := make([]*pb.Resource, 0, estimatedCapacity)

	for _, resource := range resources {
		matched, err := selector.Matches(resource)
		if err != nil {
			return []*pb.Resource{}, err
		}
		if matched {
			matchedResources = append(matchedResources, resource)
		}
	}

	return matchedResources, nil
}
