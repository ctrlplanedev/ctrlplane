package operations

import (
	"fmt"
	"reflect"
	"strings"
	"workspace-engine/pkg/model/conditions"
)

func MetadataConditionMatches(entity any, operator conditions.StringConditionOperator, field string, value string) (bool, error) {
	metadata, err := getProperty(entity, "metadata")
	if err != nil {
		return false, nil
	}

	if metadata.Kind() != reflect.Map {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	metadataMap, ok := metadata.Interface().(map[string]string)
	if !ok {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	metadataValue, ok := metadataMap[field]
	if !ok {
		return false, nil
	}

	return compareMetadataCondition(operator, metadataValue, value)
}

func compareMetadataCondition(operator conditions.StringConditionOperator, aValue string, bValue string) (bool, error) {
	switch operator {
	case conditions.StringConditionOperatorEquals:
		return aValue == bValue, nil
	case conditions.StringConditionOperatorStartsWith:
		return strings.HasPrefix(aValue, bValue), nil
	case conditions.StringConditionOperatorEndsWith:
		return strings.HasSuffix(aValue, bValue), nil
	case conditions.StringConditionOperatorContains:
		return strings.Contains(aValue, bValue), nil
	default:
		return false, fmt.Errorf("invalid column operator: %s", operator)
	}
}
