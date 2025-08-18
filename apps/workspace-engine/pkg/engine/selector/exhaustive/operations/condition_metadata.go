package operations

import (
	"fmt"
	"reflect"
	"strings"
	"workspace-engine/pkg/model/conditions"
)

func MetadataConditionMatches(entity any, operator conditions.StringConditionOperator, field string, value string) (bool, error) {
	var err error
	var ok bool
	var metadata reflect.Value
	var metadataMap map[string]string
	var metadataValue string

	if metadata, err = getProperty(entity, "metadata"); err != nil {
		// missing metadata is not an error, just means no match
		return false, nil
	}

	if metadata.Kind() != reflect.Map {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	if metadataMap, ok = metadata.Interface().(map[string]string); !ok {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	if metadataValue, ok = metadataMap[field]; !ok {
		// missing metadata key is not an error, just means no match
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
