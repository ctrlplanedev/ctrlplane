package operations

import (
	"fmt"
	"workspace-engine/pkg/model/conditions"
)

// MaxDepthAllowed defines the maximum nesting depth for conditions
const MaxDepthAllowed = 2

type JSONSelector interface {
	Matches(entity any) (bool, error)
}

func NewJSONSelector(condition conditions.JSONCondition) JSONSelector {
	return &jsonSelectorImpl{JSONCondition: condition}
}

type jsonSelectorImpl struct {
	JSONCondition conditions.JSONCondition
}

// stringFieldMapping maps condition types to their corresponding entity field names
var stringFieldMapping = map[conditions.ConditionType]string{
	conditions.ConditionTypeID:      "ID",
	conditions.ConditionTypeVersion: "Version",
	conditions.ConditionTypeName:    "Name",
	conditions.ConditionTypeSystem:  "System",
}

// dateFieldMapping maps condition types to their corresponding entity field names
var dateFieldMapping = map[conditions.ConditionType]string{
	conditions.ConditionTypeDate:      "CreatedAt",
	conditions.ConditionTypeUpdatedAt: "UpdatedAt",
}

func (c *jsonSelectorImpl) Matches(entity any) (bool, error) {
	switch c.JSONCondition.ConditionType {
	case conditions.ConditionTypeID, conditions.ConditionTypeVersion,
		conditions.ConditionTypeName, conditions.ConditionTypeSystem:
		return c.handleStringCondition(entity)

	case conditions.ConditionTypeMetadata:
		return c.handleMetadataCondition(entity)

	case conditions.ConditionTypeDate, conditions.ConditionTypeUpdatedAt:
		return c.handleDateCondition(entity)

	case conditions.ConditionTypeComparison, conditions.ConditionTypeAnd, conditions.ConditionTypeOr:
		return c.handleComparisonCondition(entity)

	default:
		return false, fmt.Errorf("unsupported condition type: %s", c.JSONCondition.ConditionType)
	}
}

func (c *jsonSelectorImpl) handleStringCondition(entity any) (bool, error) {
	field, exists := stringFieldMapping[c.JSONCondition.ConditionType]
	if !exists {
		return false, fmt.Errorf("unsupported string condition type: %s", c.JSONCondition.ConditionType)
	}

	op := conditions.StringConditionOperator(c.JSONCondition.Operator)
	return StringConditionMatches(entity, op, field, c.JSONCondition.Value)
}

func (c *jsonSelectorImpl) handleMetadataCondition(entity any) (bool, error) {
	op := conditions.StringConditionOperator(c.JSONCondition.Operator)
	return MetadataConditionMatches(entity, op, c.JSONCondition.Key, c.JSONCondition.Value)
}

func (c *jsonSelectorImpl) handleDateCondition(entity any) (bool, error) {
	field, exists := dateFieldMapping[c.JSONCondition.ConditionType]
	if !exists {
		return false, fmt.Errorf("unsupported date condition type: %s", c.JSONCondition.ConditionType)
	}

	op := conditions.DateOperator(c.JSONCondition.Operator)
	return DateConditionMatches(entity, op, field, c.JSONCondition.Value)
}

func (c *jsonSelectorImpl) handleComparisonCondition(entity any) (bool, error) {
	op := conditions.ComparisonConditionOperator(c.JSONCondition.Operator)
	childSelectors := make([]JSONSelector, len(c.JSONCondition.Conditions))
	for i, condition := range c.JSONCondition.Conditions {
		childSelectors[i] = &jsonSelectorImpl{JSONCondition: condition}
	}
	return ComparisonConditionMatches(entity, op, childSelectors)
}
