package selector

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/util"
)

func Matchable(ctx context.Context, selector *oapi.Selector) (util.MatchableCondition, error) {
	jsonSelector, err := selector.AsJsonSelector()
	if err != nil {
		return nil, fmt.Errorf("selector is not a json selector")
	}

	if len(jsonSelector.Json) != 0 {
		unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
		if err != nil {
			return nil, err
		}

		condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return nil, err
		}

		return condition, nil
	}

	cselSelector, err := selector.AsCelSelector()
	if err != nil {
		return nil, fmt.Errorf("selector is not a cel selector")
	}

	if cselSelector.Cel == "" {
		return nil, fmt.Errorf("cel selector is empty")
	}

	condition, err := cel.Compile(cselSelector.Cel)
	if err != nil {
		return nil, err
	}
	return condition, nil

}

func Match(ctx context.Context, selector *oapi.Selector, item any) (bool, error) {
	matchable, err := Matchable(ctx, selector)
	if err != nil {
		return false, err
	}

	return matchable.Matches(item)
}
