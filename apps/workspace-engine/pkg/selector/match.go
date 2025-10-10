package selector

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func Match(ctx context.Context, selector *oapi.Selector, item any) (bool, error) {
	jsonSelector, err := selector.AsJsonSelector()
	if err != nil {
		return false, fmt.Errorf("selector is not a json selector")
	}

	unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
	if err != nil {
		return false, err
	}

	condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return false, err
	}

	return condition.Matches(item)
}
