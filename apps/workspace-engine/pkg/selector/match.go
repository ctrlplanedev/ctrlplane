package selector

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func Match(ctx context.Context, selector *pb.Selector, item any) (bool, error) {
	unknownCondition, err := unknown.ParseFromMap(selector.GetJson().AsMap())
	if err != nil {
		return false, err
	}

	condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return false, err
	}

	return condition.Matches(item)
}