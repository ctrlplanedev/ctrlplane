package selector

import (
	"fmt"

	"workspace-engine/pkg/model/resource"
)

// ComparisonOperator defines logical operators for combining conditions
type ComparisonOperator string

const (
	ComparisonOperatorAnd ComparisonOperator = "and"
	ComparisonOperatorOr  ComparisonOperator = "or"
)

// ConditionType defines the types of conditions available
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
)

// Condition is the interface that all selector types must implement
type Condition interface {
	Matches(resource resource.Resource) (bool, error)
}

// ValidateComparisonOperator validates a comparison operator string
func ValidateComparisonOperator(op string) error {
	switch ComparisonOperator(op) {
	case ComparisonOperatorAnd, ComparisonOperatorOr:
		return nil
	default:
		return fmt.Errorf("invalid comparison operator: %s", op)
	}
}

// ValidateConditionType validates a selector type string
func ValidateConditionType(ct string) error {
	switch ConditionType(ct) {
	case ConditionTypeMetadata, ConditionTypeDate, ConditionTypeUpdatedAt,
		ConditionTypeComparison, ConditionTypeVersion, ConditionTypeID,
		ConditionTypeName, ConditionTypeSystem:
		return nil
	default:
		return fmt.Errorf("invalid selector type: %s", ct)
	}
}
