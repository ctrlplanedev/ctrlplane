package selector

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Selector any


func FilterResources(ctx context.Context, sel *oapi.Selector, resources []*oapi.Resource) (map[string]*oapi.Resource, error) {
	// If no selector is provided, return no resources
	if sel == nil {
		return map[string]*oapi.Resource{}, nil
	}

	selector, err := Matchable(ctx, sel)
	if err != nil {
		return nil, err
	}

	// Pre-allocate with reasonable capacity (assume ~50% match rate to minimize reallocations)
	// This avoids multiple slice reallocations during append
	estimatedCapacity := max(len(resources)/2, 128)
	matchedResources := make(map[string]*oapi.Resource, estimatedCapacity)

	for _, resource := range resources {
		matched, err := selector.Matches(resource)
		if err != nil {
			return nil, err
		}
		if matched {
			matchedResources[resource.Id] = resource
		}
	}

	return matchedResources, nil
}
