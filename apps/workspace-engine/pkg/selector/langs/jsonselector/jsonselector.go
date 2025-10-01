package jsonselector

import (
	"workspace-engine/pkg/selector/langs/jsonselector/compare"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func ConvertToSelector(unknownCondition unknown.UnknownCondition) (unknown.MatchableCondition, error) {
	return compare.ConvertToSelector(unknownCondition)
}