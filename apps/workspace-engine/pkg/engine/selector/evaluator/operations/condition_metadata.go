package operations

import (
	"fmt"
	"reflect"
	"strings"
	"workspace-engine/pkg/engine/selector"
)

type MetadataConditionOperator string

const (
	MetadataConditionOperatorEquals     MetadataConditionOperator = "equals"
	MetadataConditionOperatorStartsWith MetadataConditionOperator = "starts-with"
	MetadataConditionOperatorEndsWith   MetadataConditionOperator = "ends-with"
	MetadataConditionOperatorContains   MetadataConditionOperator = "contains"
	MetadataConditionOperatorNull       MetadataConditionOperator = "null"
)

type MetadataCondition struct {
	Operator  MetadataConditionOperator `json:"operator"`
	Key       string                    `json:"key"`
	Value     string                    `json:"value"`
}

func (c MetadataCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	metadata, err := getProperty(entity, "Metadata")
	if err != nil {
		return false, err
	}

	if metadata.Kind() != reflect.Map {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	metadataMap, ok := metadata.Interface().(map[string]string)
	if !ok {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	value, ok := metadataMap[c.Key]
	if !ok {
		if c.Operator == MetadataConditionOperatorNull {
			return true, nil
		}
		return false, nil
	}

	return compareMetadataCondition(c.Operator, value, c.Key)
}

func compareMetadataCondition(operator MetadataConditionOperator, aValue string, bValue string) (bool, error) {
	switch operator {
	case MetadataConditionOperatorEquals:
		return aValue == bValue, nil
	case MetadataConditionOperatorStartsWith:
		return strings.HasPrefix(aValue, bValue), nil
	case MetadataConditionOperatorEndsWith:
		return strings.HasSuffix(aValue, bValue), nil
	case MetadataConditionOperatorContains:
		return strings.Contains(aValue, bValue), nil
	default:
		return false, fmt.Errorf("invalid column operator: %s", operator)
	}
}