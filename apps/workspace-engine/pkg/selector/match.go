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

type NoMatchableCondition struct {
}

func (n *NoMatchableCondition) Matches(entity any) (bool, error) {
	return false, nil
}

type YesMatchableCondition struct {
}

func (y *YesMatchableCondition) Matches(entity any) (bool, error) {
	return true, nil
}

func Matchable(ctx context.Context, selector *oapi.Selector) (util.MatchableCondition, error) {
	jsonSelector, err := selector.AsJsonSelector()
	if err != nil {
		return nil, fmt.Errorf("selector is not a json selector")
	}

	if len(jsonSelector.Json) != 0 {
		unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
		if err != nil {
			return &NoMatchableCondition{}, err
		}

		condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return &NoMatchableCondition{}, err
		}

		return condition, nil
	}

	cselSelector, err := selector.AsCelSelector()
	if err != nil {
		return &NoMatchableCondition{}, fmt.Errorf("selector is not a cel selector")
	}

	if cselSelector.Cel == "" {
		return &NoMatchableCondition{}, fmt.Errorf("cel selector is empty")
	}

	condition, err := cel.Compile(cselSelector.Cel)
	if err != nil {
		return &NoMatchableCondition{}, err
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
