package selector

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("selector")

type Selector any

func FilterResources(ctx context.Context, unknownCondition unknown.UnknownCondition, resources []*pb.Resource) ([]*pb.Resource, error) {
	_, span := tracer.Start(ctx, "FilterResources")
	defer span.End()

	selector, err := jsonselector.ConvertToSelector(unknownCondition)
	if err != nil {
		return []*pb.Resource{}, err
	}

	matchedResources := []*pb.Resource{}
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
