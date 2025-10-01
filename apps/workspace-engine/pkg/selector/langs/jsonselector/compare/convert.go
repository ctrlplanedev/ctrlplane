package compare

import (
	"fmt"
	"workspace-engine/pkg/selector/langs/jsonselector/date"
	"workspace-engine/pkg/selector/langs/jsonselector/metadata"
	cstring "workspace-engine/pkg/selector/langs/jsonselector/string"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

var propertyAliases = map[string]string{
	"created-at": "CreatedAt",
	"deleted-at": "DeletedAt",
	"updated-at": "UpdatedAt",
	"metadata":   "Metadata",
	"version":    "Version",
	"kind":       "Kind",
	"identifier": "Identifier",
	"name":       "Name",
	"id":         "Id",
}

func ConvertToSelector(unknownCondition unknown.UnknownCondition) (unknown.MatchableCondition, error) {
	comparisonCondition, err := ConvertFromUnknownCondition(unknownCondition)
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
