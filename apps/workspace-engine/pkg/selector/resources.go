package selector

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

type Selector any

func FilterMatchingResources(ctx context.Context, sel *oapi.Selector, resource *oapi.Resource) (bool, error) {
	jsonSelector, err := sel.AsJsonSelector()
	if err != nil {
		return false, err
	}

	unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
	if err != nil {
		return false, err
	}

	condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return false, err
	}

	return condition.Matches(resource)
}

func FilterResources(ctx context.Context, sel *oapi.Selector, resources []*oapi.Resource) (map[string]*oapi.Resource, error) {
	// If no selector is provided, return no resources
	if sel == nil {
		return map[string]*oapi.Resource{}, nil
	}

	jsonSelector, err := sel.AsJsonSelector()
	if err != nil {
		return nil, err
	}

	if jsonSelector.Json == nil {
		return map[string]*oapi.Resource{}, nil
	}

	unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
	if err != nil {
		return nil, err
	}

	selector, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
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
