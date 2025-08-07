package conditions

type ComparisonConditionOperator string

const (
	ComparisonConditionOperatorAnd ComparisonConditionOperator = "and"
	ComparisonConditionOperatorOr  ComparisonConditionOperator = "or"
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

type StringConditionOperator string

const (
	StringConditionOperatorEquals     StringConditionOperator = "equals"
	StringConditionOperatorStartsWith StringConditionOperator = "starts-with"
	StringConditionOperatorEndsWith   StringConditionOperator = "ends-with"
	StringConditionOperatorContains   StringConditionOperator = "contains"
)

type DateOperator string

const (
	DateOperatorBefore     DateOperator = "before"
	DateOperatorAfter      DateOperator = "after"
	DateOperatorBeforeOrOn DateOperator = "before-or-on"
	DateOperatorAfterOrOn  DateOperator = "after-or-on"
)

type JSONCondition struct {
	ConditionType ConditionType   `json:"type"`
	Operator      string          `json:"operator"`
	Value         string          `json:"value"`
	Key           string          `json:"key"`
	Conditions    []JSONCondition `json:"conditions"`
}
