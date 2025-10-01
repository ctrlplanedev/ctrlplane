package convert

import (
	"fmt"
	"workspace-engine/pkg/selector/langs/jsonselector/compare"
	"workspace-engine/pkg/selector/langs/jsonselector/date"
	"workspace-engine/pkg/selector/langs/jsonselector/metadata"
	cstring "workspace-engine/pkg/selector/langs/jsonselector/string"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func ConvertToSelector(unknownCondition unknown.UnknownCondition) (unknown.MatchableCondition, error) {
	comparisonCondition, err := compare.ConvertFromUnknownCondition(unknownCondition)
	if err == nil {
		return comparisonCondition, nil
	}

	metadataCondition, err := metadata.ConvertFromUnknownCondition(unknownCondition)
	if err == nil {
		return metadataCondition, nil
	}

	dateCondition, err := date.ConvertFromUnknownCondition(unknownCondition)
	if err == nil {
		return dateCondition, nil
	}

	stringCondition, err := cstring.ConvertFromUnknownCondition(unknownCondition)
	if err == nil {
		return stringCondition, nil
	}

	return nil, fmt.Errorf("invalid condition type: %s", unknownCondition.Operator)
}