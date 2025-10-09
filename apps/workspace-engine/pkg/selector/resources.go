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

func FilterMatchingResources(ctx context.Context, sel *pb.Selector, resource *pb.Resource) (bool, error) {
	unknownCondition, err := unknown.ParseFromMap(sel.GetJson().AsMap())
	if err != nil {
		return false, err
	}

	condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return false, err
	}

	return condition.Matches(resource)
}

func FilterResources(ctx context.Context, sel *pb.Selector, resources []*pb.Resource) (map[string]*pb.Resource, error) {
	ctx, span := tracer.Start(ctx, "FilterResources")
	defer span.End()

	// If no selector is provided, return no resources
	if sel == nil || sel.GetJson() == nil {
		return map[string]*pb.Resource{}, nil
	}

	unknownCondition, err := unknown.ParseFromMap(sel.GetJson().AsMap())
	if err != nil {
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.input", len(resources)))

	selector, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return nil, err
	}

	// Pre-allocate with reasonable capacity (assume ~50% match rate to minimize reallocations)
	// This avoids multiple slice reallocations during append
	estimatedCapacity := max(len(resources)/2, 128)
	matchedResources := make(map[string]*pb.Resource, estimatedCapacity)

	for _, resource := range resources {
		matched, err := selector.Matches(resource)
		if err != nil {
			return nil, err
		}
		if matched {
			matchedResources[resource.Id] = resource
		}
	}

	span.SetAttributes(attribute.Int("resources.output", len(matchedResources)))
	return matchedResources, nil
}
