package selector

import (
	"context"
	"encoding/json"
	"fmt"

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
	if sel != nil {
		// Try to marshal the resource selector to JSON for readability
		if jsonBytes, err := json.MarshalIndent(sel, "", "  "); err == nil {
			fmt.Printf("selector:\n%s\n", string(jsonBytes))
		} else {
			fmt.Printf("ResourceSelector for selector (marshal error: %v): %#v\n", err, sel)
		}
	} else {
		fmt.Printf("ResourceSelector for selector: <nil>\n")
	}

	// If no selector is provided, return no resources
	if sel == nil {
		return map[string]*oapi.Resource{}, nil
	}

	jsonSelector, err := sel.AsJsonSelector()
	if err != nil {
		return nil, err
	}

	if jsonBytes, err := json.MarshalIndent(jsonSelector, "", "  "); err == nil {
		fmt.Printf("jsonSelector:\n%s\n", string(jsonBytes))
	} else {
		fmt.Printf("jsonSelector (marshal error: %v): %#v\n", err, jsonSelector)
	}

	if jsonSelector.Json == nil {
		return map[string]*oapi.Resource{}, nil
	}

	unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
	if err != nil {
		return nil, err
	}

	if jsonBytes, err := json.MarshalIndent(unknownCondition, "", "  "); err == nil {
		fmt.Printf("unknownCondition:\n%s\n", string(jsonBytes))
	} else {
		fmt.Printf("unknownCondition (marshal error: %v): %#v\n", err, unknownCondition)
	}

	selector, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return nil, err
	}

	if jsonBytes, err := json.MarshalIndent(selector, "", "  "); err == nil {
		fmt.Printf("selector:\n%s\n", string(jsonBytes))
	} else {
		fmt.Printf("selector (marshal error: %v): %#v\n", err, selector)
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

	fmt.Printf("matchedResources: %d\n", len(matchedResources))

	return matchedResources, nil
}
