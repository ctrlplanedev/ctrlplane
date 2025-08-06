package operations

import (
	"fmt"
	"time"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/conditions"
)

// MaxDepthAllowed defines the maximum nesting depth for conditions
const MaxDepthAllowed = 2

type UnknownCondition struct {
	JSONCondition conditions.JSONCondition
}

func (c UnknownCondition) GetCondition() (selector.Condition[selector.MatchableEntity], error) {
	cs := make([]selector.Condition[selector.MatchableEntity], len(c.JSONCondition.Conditions))
	for i, cond := range c.JSONCondition.Conditions {
		condition, err := UnknownCondition{cond}.GetCondition()
		if err != nil {
			return nil, err
		}
		cs[i] = condition
	}

	conditionType := c.JSONCondition.ConditionType
	switch conditionType {
	case conditions.ConditionTypeAnd:
		return &ComparisonCondition{ComparisonConditionOperatorAnd, cs}, nil
	case conditions.ConditionTypeOr:
		return &ComparisonCondition{ComparisonConditionOperatorOr, cs}, nil
	case conditions.ConditionTypeMetadata:
		return &MetadataCondition{MetadataConditionOperator(c.JSONCondition.Operator), c.JSONCondition.Key, c.JSONCondition.Value}, nil
	case conditions.ConditionTypeDate:
		date, err := time.Parse(time.RFC3339, c.JSONCondition.Value)
		if err != nil {
			return nil, err
		}
		return &DateCondition{c.JSONCondition.ConditionType, conditions.DateOperator(c.JSONCondition.Operator), date}, nil
	case conditions.ConditionTypeUpdatedAt:
		date, err := time.Parse(time.RFC3339, c.JSONCondition.Value)
		if err != nil {
			return nil, err
		}
		return &DateCondition{c.JSONCondition.ConditionType, conditions.DateOperator(c.JSONCondition.Operator), date}, nil
	case conditions.ConditionTypeVersion:
		return &StringCondition{c.JSONCondition.ConditionType, conditions.StringConditionOperator(c.JSONCondition.Operator), c.JSONCondition.Value}, nil
	case conditions.ConditionTypeID:
		return &StringCondition{conditionType, conditions.StringConditionOperator(c.JSONCondition.Operator), c.JSONCondition.Value}, nil
	case conditions.ConditionTypeName:
		return &StringCondition{conditionType, conditions.StringConditionOperator(c.JSONCondition.Operator), c.JSONCondition.Value}, nil
	case conditions.ConditionTypeSystem:
		return &StringCondition{conditionType, conditions.StringConditionOperator(c.JSONCondition.Operator), c.JSONCondition.Value}, nil
	}
	return nil, fmt.Errorf("invalid condition type: %s", c.JSONCondition.ConditionType)
}

func (c UnknownCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	condition, err := c.GetCondition()
	if err != nil {
		return false, err
	}
	return condition.Matches(entity)
}
