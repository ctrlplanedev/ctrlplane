package selector

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func Match(ctx context.Context, selector *oapi.Selector, item any) (bool, error) {
	jsonSelector, err := selector.AsJsonSelector()
	if err != nil {
		return false, fmt.Errorf("selector is not a json selector")
	}

	if len(jsonSelector.Json) != 0 {
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

	cselSelector, err := selector.AsCelSelector()
	if err != nil {
		return false, fmt.Errorf("selector is not a cel selector")
	}

	if cselSelector.Cel != "" {
		return false, nil
	}

	celCtx := &cel.Context{}
	if oresource, ok := item.(oapi.Resource); ok {
		celCtx.Resource = oresource
	}
	if odeployment, ok := item.(oapi.Deployment); ok {
		celCtx.Deployment = odeployment
	}
	if oenvironment, ok := item.(oapi.Environment); ok {
		celCtx.Environment = oenvironment
	}

	condition, err := cel.Compile(cselSelector.Cel)
	if err != nil {
		return false, err
	}

	return condition.Matches(celCtx)
}
