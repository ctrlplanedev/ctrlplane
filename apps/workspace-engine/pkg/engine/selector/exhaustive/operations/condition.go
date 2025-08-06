package operations

import (
	"fmt"
	"time"
	"workspace-engine/pkg/engine/selector"
)

// MaxDepthAllowed defines the maximum nesting depth for conditions
const MaxDepthAllowed = 2

type ComparisonOperator string

const (
	ComparisonOperatorAnd ComparisonOperator = "and"
	ComparisonOperatorOr  ComparisonOperator = "or"
)

type ConditionType string

const (
	ConditionTypeMetadata   ConditionType = "metadata"
	ConditionTypeDate       ConditionType = "created-at"
	ConditionTypeUpdatedAt  ConditionType = "updated-at"
	ConditionTypeComparison ConditionType = "comparison"
	ConditionTypeVersion    ConditionType = "version"
	ConditionTypeID         ConditionType = "id"
	ConditionTypeName       ConditionType = "name"
	ConditionTypeSystem     ConditionType = "system"
	ConditionTypeAnd        ConditionType = "and"
	ConditionTypeOr         ConditionType = "or"
)

type UnknownCondition struct {
	ConditionType ConditionType      `json:"type"`
	Operator      string             `json:"operator"`
	Value         string             `json:"value"`
	Key           string             `json:"key"`
	Conditions    []UnknownCondition `json:"conditions"`
}

func (c UnknownCondition) GetCondition() (selector.Condition, error) {
	conditions := make([]selector.Condition, len(c.Conditions))
	for i, cond := range c.Conditions {
		condition, err := cond.GetCondition()
		if err != nil {
			return nil, err
		}
		conditions[i] = condition
	}
	switch c.ConditionType {
	case ConditionTypeAnd:
		return &ComparisonCondition{ComparisonConditionOperatorAnd, conditions}, nil
	case ConditionTypeOr:
		return &ComparisonCondition{ComparisonConditionOperatorOr, conditions}, nil
	case ConditionTypeMetadata:
		return &MetadataCondition{MetadataConditionOperator(c.Operator), c.Key, c.Value}, nil
	case ConditionTypeDate:
		date, err := time.Parse(time.RFC3339, c.Value)
		if err != nil {
			return nil, err
		}
		return &DateCondition{c.ConditionType, DateOperator(c.Operator), date}, nil
	case ConditionTypeUpdatedAt:
		date, err := time.Parse(time.RFC3339, c.Value)
		if err != nil {
			return nil, err
		}
		return &DateCondition{c.ConditionType, DateOperator(c.Operator), date}, nil
	case ConditionTypeVersion:
		return &StringCondition{c.ConditionType, StringConditionOperator(c.Operator), c.Value}, nil
	case ConditionTypeID:
		return &StringCondition{c.ConditionType, StringConditionOperator(c.Operator), c.Value}, nil
	case ConditionTypeName:
		return &StringCondition{c.ConditionType, StringConditionOperator(c.Operator), c.Value}, nil
	case ConditionTypeSystem:
		return &StringCondition{c.ConditionType, StringConditionOperator(c.Operator), c.Value}, nil
	}
	return nil, fmt.Errorf("invalid condition type: %s", c.ConditionType)
}

func (c UnknownCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	condition, err := c.GetCondition()
	if err != nil {
		return false, err
	}
	return condition.Matches(entity)
}
