package metadata

import (
	"fmt"
	"reflect"
	cstring "workspace-engine/pkg/selector/langs/jsonselector/string"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/jsonselector/util"
)

type MetadataCondition struct {
	Operator cstring.StringConditionOperator `json:"operator"`
	Key      string                          `json:"key"`
	Value    string                          `json:"value"`
}

func (c MetadataCondition) Matches(entity any) (bool, error) {
	var err error
	var ok bool
	var metadata reflect.Value
	var metadataMap map[string]string
	var metadataValue string

	if metadata, err = util.GetProperty(entity, "metadata"); err != nil {
		// missing metadata is not an error, just means no match
		return false, nil
	}

	if metadata.Kind() != reflect.Map {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	if metadataMap, ok = metadata.Interface().(map[string]string); !ok {
		return false, fmt.Errorf("field %s is not a map", "Metadata")
	}

	if metadataValue, ok = metadataMap[c.Key]; !ok {
		// missing metadata key is not an error, just means no match
		return false, nil
	}

	return cstring.CompareStringCondition(c.Operator, metadataValue, c.Value)
}

func ConvertFromUnknownCondition(condition unknown.UnknownCondition) (MetadataCondition, error) {
	validOperators := map[cstring.StringConditionOperator]struct{}{
		cstring.StringConditionOperatorEquals:     {},
		cstring.StringConditionOperatorStartsWith: {},
		cstring.StringConditionOperatorEndsWith:   {},
		cstring.StringConditionOperatorContains:   {},
	}
	if _, ok := validOperators[cstring.StringConditionOperator(condition.Operator)]; !ok {
		return MetadataCondition{}, fmt.Errorf("invalid string operator: %s", condition.Operator)
	}

	normalizedProperty := condition.GetNormalizedProperty()
	if normalizedProperty != "Metadata" {
		return MetadataCondition{}, fmt.Errorf("property must be 'metadata', got '%s'", condition.Property)
	}

	if condition.MetadataKey == "" {
		return MetadataCondition{}, fmt.Errorf("metadata key cannot be empty")
	}

	return MetadataCondition{
		Operator: cstring.StringConditionOperator(condition.Operator),
		Key:      condition.MetadataKey,
		Value:    condition.Value,
	}, nil
}
